"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Volume2,
  VolumeX,
  Gauge,
  Mic,
  Maximize2,
  Minimize2,
  Settings,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Sparkles,
  Type,
  Sun,
  Moon,
  Check,
  HelpCircle,
  Home,
  BookOpen,
  Gamepad2,
  BookMarked,
  Compass,
  PenTool,
  Timer,
  Dices,
  MoreHorizontal,
  Lightbulb,
  AudioLines,
  Users,
  GraduationCap,
} from "lucide-react";
import { useSfxStore } from "@/store/sfxStore";
import { useSettings, ViewMode, SpeechRate } from "@/store/settings";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";
import { playClick, playSuccess } from "@/lib/sfxManager";
import { usePwaInstall } from "@/lib/usePwaInstall";
import {
  applyGlobalTypographyCssVars,
  ARABIC_FONT_OPTIONS,
  ARABIC_FONT_SIZE_PRESETS,
} from "@/lib/arabicTextUtils";
import { triggerGuideModal } from "@/components/ui/GuideAndInfoModal";
import {
  registerActiveMediaStream,
  stopAllActiveMediaStreams,
} from "@/lib/universalStt";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  stacked: "Alt Alta (Arapça + Türkçe)",
  columns: "İki Sütun (Yan Yana)",
  "arabic-only": "Sadece Arapça",
  "turkish-only": "Sadece Türkçe (Kendini Sına)",
  "click-reveal": "Tıkla-Gör (Çeviri Gizli)",
};

const SPEECH_RATE_OPTIONS: SpeechRate[] = [0.5, 0.75, 1, 1.25, 1.5];

const emptySubscribe = () => () => {};

export default function Header() {
  const pathname = usePathname();
  const { enabled: sfxEnabled, toggle: toggleSfx } = useSfxStore();
  const {
    theme,
    toggleTheme,
    showHareke,
    harekeMode,
    cycleHarekeMode,
    viewMode,
    setViewMode,
    speechRate,
    setSpeechRate,
    arabicFont,
    setArabicFont,
    arabicFontSize,
    arabicFontSizePreset,
    setArabicFontSizePreset,
    turkishFontSize,
    showTooltips,
    toggleTooltips,
    micNoiseSuppression,
    toggleMicNoiseSuppression,
    preferredVoiceGender,
    togglePreferredVoiceGender,
    grammarDepthMode,
    toggleGrammarDepthMode,
  } = useSettings();
  const {
    isOpen: smartboardOpen,
    timerOpen,
    pickerOpen,
    toggleToolbar: toggleSmartboardToolbar,
    toggleTimer,
    setTimerOpen,
    setPickerOpen,
  } = useClassroomToolsStore();
  const { isInstallable, isInstalled, isIOS, installApp } = usePwaInstall();

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iosInstallOpen, setIosInstallOpen] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  // Mikrofon Testi Modal State & İzin Yarışı Koruması
  const [micModalOpen, setMicModalOpen] = useState(false);
  const [micStatus, setMicStatus] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [micMessage, setMicMessage] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const micTestSessionIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    applyGlobalTypographyCssVars({
      arabicFont,
      arabicFontSize,
      arabicFontSizePreset,
      turkishFontSize,
    });
  }, [arabicFont, arabicFontSize, arabicFontSizePreset, turkishFontSize]);

  const closeMicTestResourcesOnly = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      streamRef.current = null;
    }
    stopAllActiveMediaStreams();
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setMicLevel(0);
  }, []);

  const stopMicTest = useCallback(() => {
    micTestSessionIdRef.current += 1;
    closeMicTestResourcesOnly();
  }, [closeMicTestResourcesOnly]);

  useEffect(() => {
    isMountedRef.current = true;
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fontMenuRef.current &&
        !fontMenuRef.current.contains(e.target as Node)
      ) {
        setFontMenuOpen(false);
      }
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFontMenuOpen(false);
        setMoreMenuOpen(false);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopMicTest();
        setMicModalOpen(false);
        setMicStatus("idle");
      }
    };
    const handlePageHide = () => {
      stopMicTest();
      setMicModalOpen(false);
      setMicStatus("idle");
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      isMountedRef.current = false;
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      stopMicTest();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMicTest = async () => {
    setMicStatus("testing");
    setMicMessage("Mikrofona doğru Arapça bir kelime söyleyin...");
    closeMicTestResourcesOnly();

    const sessionId = ++micTestSessionIdRef.current;
    let acquiredStream: MediaStream | null = null;
    try {
      const { micNoiseSuppression: currentNoiseSuppression } =
        useSettings.getState();
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: Boolean(currentNoiseSuppression),
            noiseSuppression: Boolean(currentNoiseSuppression),
            autoGainControl: true,
          },
        });
      } catch {
        acquiredStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }
      const stream = acquiredStream;
      if (
        !isMountedRef.current ||
        sessionId !== micTestSessionIdRef.current
      ) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      registerActiveMediaStream(stream);
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AC();
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silentGain);
      silentGain.connect(ctx.destination);
      const data = new Float32Array(analyser.fftSize);

      let peakDetected = false;
      const tick = () => {
        if (
          !isMountedRef.current ||
          sessionId !== micTestSessionIdRef.current
        ) {
          return;
        }
        analyser.getFloatTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
        const rms = Math.sqrt(sumSq / data.length);
        const avg = Math.min(100, Math.round(Math.min(1, rms * 6) * 100));
        setMicLevel(avg);
        if (avg > 18 && !peakDetected) {
          peakDetected = true;
          setMicStatus("ok");
          setMicMessage("Harika! Mikrofonunuz net şekilde ses alıyor.");
          playSuccess();
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      if (acquiredStream) {
        try {
          acquiredStream.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
      }
      closeMicTestResourcesOnly();
      if (isMountedRef.current && sessionId === micTestSessionIdRef.current) {
        setMicStatus("error");
        const errMsg =
          err instanceof Error && err.message
            ? err.message
            : "Tarayıcı adres çubuğundan mikrofon iznini kontrol edin.";
        setMicMessage("Mikrofon açılamadı: " + errMsg);
      }
    }
  };

  const handleToggleMicModal = () => {
    playClick();
    if (micModalOpen) {
      stopMicTest();
      setMicModalOpen(false);
      setMicStatus("idle");
    } else {
      setMicModalOpen(true);
      startMicTest();
    }
  };

  const handleToggleFullscreen = async () => {
    playClick();
    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
      };
      const isFs = Boolean(
        document.fullscreenElement || doc.webkitFullscreenElement
      );
      if (!isFs) {
        if (typeof docEl.requestFullscreen === "function") {
          await docEl.requestFullscreen();
        } else if (typeof docEl.webkitRequestFullscreen === "function") {
          await docEl.webkitRequestFullscreen();
        } else if (isIOS && !isInstalled) {
          setIosInstallOpen(true);
        }
      } else {
        if (typeof document.exitFullscreen === "function") {
          await document.exitFullscreen();
        } else if (typeof doc.webkitExitFullscreen === "function") {
          await doc.webkitExitFullscreen();
        }
      }
    } catch {
      if (isIOS && !isInstalled) {
        setIosInstallOpen(true);
      }
    }
  };

  const navLinks = [
    {
      href: "/",
      label: "Ana Sayfa",
      Icon: Home,
      tooltip: "Ana Sayfa",
    },
    {
      href: "/kutuphane",
      label: "Eğitim Kütüphanesi",
      Icon: BookOpen,
      tooltip: "Eğitim Kütüphanesi",
    },
    {
      href: "/alistirmalar",
      label: "Alıştırmalar ve Oyunlar",
      Icon: Gamepad2,
      tooltip: "Alıştırmalar ve Oyunlar",
    },
    {
      href: "/seviye-tespit",
      label: "Sınav ve Konu Tarama",
      Icon: Compass,
      tooltip: "Sınav ve Konu Tarama",
    },
    {
      href: "/sozluk",
      label: "İnteraktif Sözlük",
      Icon: BookMarked,
      tooltip: "İnteraktif Sözlük",
    },
    {
      href: "/ayarlar",
      label: "Ayarlar",
      Icon: Settings,
      tooltip: "Ayarlar",
    },
  ];

  const activeHarekeMode = !mounted
    ? "full"
    : harekeMode || (showHareke ? "full" : "none");
  const harekeTooltipText =
    activeHarekeMode === "full"
      ? "Hareke Modu: Tam / Yarı / Kapalı (Aktif: Tam)"
      : activeHarekeMode === "irab-only"
      ? "Hareke Modu: Tam / Yarı / Kapalı (Aktif: Yarı - İ'rab)"
      : "Hareke Modu: Tam / Yarı / Kapalı (Aktif: Kapalı)";

  const currentViewMode: ViewMode = mounted ? viewMode : "stacked";
  const isDark = mounted && theme === "dark";
  const canInstall = (isInstallable || isIOS) && !isInstalled;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 print:hidden w-full h-12 lg:h-14 py-1 pt-[env(safe-area-inset-top)] bg-[#FDFBF7]/95 dark:bg-[var(--background)]/95 backdrop-blur-md border-b-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-xs flex items-center overflow-visible">
        <div className="w-full max-w-7xl mx-auto px-1.5 sm:px-3 xl:px-6 h-full flex items-center justify-between gap-1.5 sm:gap-2 lg:gap-4 min-w-0 overflow-visible">
          {/* =============================================================== */}
          {/* 1. BÖLGE (SOL): Logo + Muallimun Arapça (Sıfır Çakışma)         */}
          {/* =============================================================== */}
          <div className="shrink-0 flex items-center">
            <Link
              href="/"
              onClick={() => playClick()}
              className="flex items-center gap-1 sm:gap-2 group shrink-0"
              data-tooltip="Muallimun Arapça — Ana Sayfa"
              data-tooltip-pos="bottom"
              data-tooltip-align="left"
              aria-label="Muallimun Arapça Ana Sayfa"
            >
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center justify-center shrink-0 group-active:translate-y-0.5 transition-transform p-0.5">
                <img
                  src="/icons/android-chrome-192x192.png"
                  alt="Muallimun Arapça Logo"
                  className="w-5 h-5 sm:w-6 sm:h-6 object-contain rounded-lg"
                />
              </div>
              <span className="text-[12px] sm:text-sm font-extrabold tracking-tight text-[var(--foreground)] whitespace-nowrap shrink-0 leading-none">
                Muallimun Arapça
              </span>
            </Link>
          </div>

          {/* =============================================================== */}
          {/* 2. BÖLGE (ORTA): Tamamı Metinsiz Büyük Masaüstü İkon Navigasyonu*/}
          {/* =============================================================== */}
          <nav
            aria-label="Ana Navigasyon"
            className="hidden lg:flex items-center justify-center gap-1.5 bg-slate-200/55 dark:bg-slate-800/65 p-1 rounded-2xl border border-slate-300/60 dark:border-slate-700/60 shrink-0 overflow-visible"
          >
            {navLinks.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const NavIcon = item.Icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  data-tooltip={item.tooltip}
                  data-tooltip-pos="bottom"
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
                  className={
                    isActive
                      ? "w-11 h-11 rounded-xl bg-[#087F5B] text-white shadow-xs ring-2 ring-[#087F5B]/25 flex items-center justify-center transition-all shrink-0"
                      : "w-11 h-11 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-white/90 dark:hover:bg-slate-700/75 hover:text-[#065F46] dark:hover:text-emerald-300 transition-all flex items-center justify-center shrink-0"
                  }
                >
                  <NavIcon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2.1}
                    className="shrink-0"
                  />
                </Link>
              );
            })}
          </nav>

          {/* =============================================================== */}
          {/* 3. BÖLGE (SAĞ): Hızlı Araç İkonları (Hareke, Font, Tahta, Sayaç, ⋯) */}
          {/* =============================================================== */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-visible">
            {/* 1) Hareke Modu İkon Butonu */}
            <button
              type="button"
              onClick={() => {
                cycleHarekeMode();
                playClick();
              }}
              data-tooltip={harekeTooltipText}
              data-tooltip-pos="bottom"
              aria-label={harekeTooltipText}
              className={`relative w-9 h-9 lg:w-10 lg:h-10 rounded-xl border-2 border-b-3 flex items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                activeHarekeMode === "full"
                  ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-400"
                  : activeHarekeMode === "irab-only"
                  ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              <Sparkles
                size={20}
                strokeWidth={2.2}
                className="w-4 h-4 lg:w-5 lg:h-5 shrink-0"
              />
              <span
                aria-hidden="true"
                className={`absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${
                  activeHarekeMode === "full"
                    ? "bg-[#087F5B]"
                    : activeHarekeMode === "irab-only"
                    ? "bg-amber-500"
                    : "bg-slate-400"
                }`}
              />
            </button>

            {/* 2) Yazı Tipi & Boyutu (Type İkonu) */}
            <div className="relative shrink-0 overflow-visible" ref={fontMenuRef}>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setMoreMenuOpen(false);
                  setFontMenuOpen((prev) => !prev);
                }}
                data-tooltip="Arapça Font ve Yazı Boyutu"
                data-tooltip-pos="bottom"
                aria-label="Arapça Font ve Yazı Boyutu"
                aria-expanded={fontMenuOpen}
                className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl border-2 border-b-3 flex items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                  fontMenuOpen
                    ? "bg-[#087F5B] border-[#065F46] text-white"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:bg-[#EFE3CE] dark:hover:bg-slate-800"
                }`}
              >
                <Type
                  size={20}
                  strokeWidth={2.3}
                  className="w-4 h-4 lg:w-5 lg:h-5 shrink-0"
                />
              </button>

              {fontMenuOpen && (
                <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-13 sm:top-full sm:mt-2 sm:w-[348px] max-w-sm ml-auto rounded-2xl bg-[#FDFBF7] dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 border-b-4 p-3 shadow-2xl z-50 space-y-3 max-h-[82dvh] overflow-y-auto">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E6D7BE]/80 dark:border-slate-800">
                    <span className="text-xs font-extrabold text-[var(--foreground)]">
                      Arapça Font, Boyut ve Görünüm
                    </span>
                    <button
                      type="button"
                      onClick={() => setFontMenuOpen(false)}
                      className="w-6 h-6 rounded-lg bg-[#F7EFE1] dark:bg-slate-800 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                      aria-label="Font Menüsünü Kapat"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Arapça Yazı Boyutu */}
                  <div className="space-y-1.5">
                    <span className="block px-0.5 text-[11px] font-bold text-[var(--muted)]">
                      Yazı Boyutu (Tüm Uygulama)
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {ARABIC_FONT_SIZE_PRESETS.map((preset) => {
                        const active =
                          mounted && arabicFontSizePreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              playClick();
                              setArabicFontSizePreset(preset.id);
                            }}
                            className={`px-1 py-2 rounded-xl text-[11px] font-extrabold whitespace-nowrap text-center leading-tight border cursor-pointer transition-all ${
                              active
                                ? "bg-[#087F5B] border-[#065F46] text-white"
                                : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#087F5B]"
                            }`}
                          >
                            {preset.label.split(" (")[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Arapça Yazı Tipi Ailesi */}
                  <div className="space-y-1.5 pt-1 border-t border-dashed border-[#E2D3B8] dark:border-slate-800">
                    <span className="block px-0.5 text-[11px] font-bold text-[var(--muted)]">
                      Arapça Yazı Tipi
                    </span>
                    <div className="space-y-1">
                      {ARABIC_FONT_OPTIONS.map((fontOpt) => {
                        const active = mounted && arabicFont === fontOpt.id;
                        return (
                          <button
                            key={fontOpt.id}
                            type="button"
                            onClick={() => {
                              playClick();
                              setArabicFont(fontOpt.id);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                              active
                                ? "bg-[#087F5B] text-white"
                                : "bg-[#F7EFE1]/70 dark:bg-slate-800/70 text-[var(--foreground)] hover:bg-[#F7EFE1] dark:hover:bg-slate-800"
                            }`}
                          >
                            <span className="truncate pr-2">
                              {fontOpt.name.split(" (")[0]}
                            </span>
                            <span
                              dir="rtl"
                              lang="ar"
                              style={{ fontFamily: fontOpt.cssFamily }}
                              className="text-base leading-none shrink-0"
                            >
                              بِسْمِ اللّٰهِ
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Çeviri Görünüm Modu */}
                  <div className="space-y-1.5 pt-1 border-t border-dashed border-[#E2D3B8] dark:border-slate-800">
                    <span className="block px-0.5 text-[11px] font-bold text-[var(--muted)]">
                      Çeviri Görünüm Modu
                    </span>
                    <div className="space-y-1">
                      {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map(
                        (mode) => {
                          const active = currentViewMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                playClick();
                                setViewMode(mode);
                                setFontMenuOpen(false);
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                active
                                  ? "bg-[#087F5B] text-white"
                                  : "text-[var(--foreground)] hover:bg-[#F7EFE1] dark:hover:bg-slate-800"
                              }`}
                            >
                              <span>{VIEW_MODE_LABELS[mode]}</span>
                              {active && <Check size={14} strokeWidth={3} />}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3) Tahta Çizim Aracı (PenTool İkonu) */}
            <button
              type="button"
              onClick={() => {
                playClick();
                setFontMenuOpen(false);
                setMoreMenuOpen(false);
                toggleSmartboardToolbar();
              }}
              data-tooltip="Tahta Çizim ve Sınıf Araçları"
              data-tooltip-pos="bottom"
              aria-label="Tahta Çizim ve Sınıf Araçları"
              aria-pressed={smartboardOpen}
              className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl border-2 border-b-3 flex items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                smartboardOpen
                  ? "bg-[#087F5B] border-[#065F46] text-white"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:bg-[#EFE3CE] dark:hover:bg-slate-800"
              }`}
            >
              <PenTool
                size={20}
                strokeWidth={2.2}
                className="w-4 h-4 lg:w-5 lg:h-5 shrink-0"
              />
            </button>

            {/* 4) Bağımsız Ders Sayacı & Sınıf Kurası Hızlı Erişim Butonu */}
            <button
              type="button"
              onClick={() => {
                playClick();
                setFontMenuOpen(false);
                setMoreMenuOpen(false);
                toggleTimer();
              }}
              data-tooltip="Ders Sayacı ve Sınıf Kurası"
              data-tooltip-pos="bottom"
              aria-label="Ders Sayacı ve Sınıf Kurası"
              aria-pressed={timerOpen || pickerOpen}
              className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl border-2 border-b-3 flex items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                timerOpen || pickerOpen
                  ? "bg-[#6741D9] border-[#5230B5] text-white"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:bg-[#EFE3CE] dark:hover:bg-slate-800"
              }`}
            >
              <Timer
                size={20}
                strokeWidth={2.2}
                className="w-4 h-4 lg:w-5 lg:h-5 shrink-0"
              />
            </button>

            {/* 5) ⋯ (MoreHorizontal — Hızlı Araçlar Açılır Menüsü) */}
            <div className="relative shrink-0 overflow-visible" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setFontMenuOpen(false);
                  setMoreMenuOpen((prev) => !prev);
                }}
                data-tooltip="Diğer Araçlar ve Yardım"
                data-tooltip-pos="bottom"
                data-tooltip-align="right"
                aria-label="Diğer Araçlar ve Yardım"
                aria-expanded={moreMenuOpen}
                className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl border-2 border-b-3 flex items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                  moreMenuOpen
                    ? "bg-[#087F5B] border-[#065F46] text-white"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:bg-[#EFE3CE] dark:hover:bg-slate-800"
                }`}
              >
                <MoreHorizontal
                  size={20}
                  strokeWidth={2.4}
                  className="w-4 h-4 lg:w-5 lg:h-5 shrink-0"
                />
              </button>

              {moreMenuOpen && (
                <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-13 lg:top-15 sm:top-full sm:mt-2 sm:w-80 max-w-sm ml-auto rounded-2xl bg-[#FDFBF7] dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 border-b-4 p-3 shadow-2xl z-50 space-y-2 max-h-[84dvh] overflow-y-auto">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E6D7BE]/80 dark:border-slate-800">
                    <span className="text-xs font-extrabold text-[var(--foreground)]">
                      Hızlı Araçlar ve Tercihler
                    </span>
                    <button
                      type="button"
                      onClick={() => setMoreMenuOpen(false)}
                      className="w-6 h-6 rounded-lg bg-[#F7EFE1] dark:bg-slate-800 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                      aria-label="Menüyü Kapat"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* 0. EN ÜST HIZLI SINIF ARAÇLARI: Kronometre & Geri Sayım ve Sınıf Kura Çarkı */}
                  <div className="space-y-1.5 pb-1.5 border-b border-dashed border-[#E2D3B8] dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setMoreMenuOpen(false);
                        setTimerOpen(true);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#087F5B]/10 dark:bg-emerald-950/45 border border-[#087F5B]/40 dark:border-emerald-700/60 flex items-center justify-between text-xs font-extrabold text-[#065F46] dark:text-emerald-300 hover:bg-[#087F5B]/18 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Timer size={15} className="shrink-0" />
                        <span>Kronometre &amp; Geri Sayım</span>
                      </span>
                      <span className="text-[11px] font-bold">
                        {timerOpen ? "Açık" : "Aç"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setMoreMenuOpen(false);
                        setPickerOpen(true);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F3F0FF] dark:bg-purple-950/45 border border-[#6741D9]/40 dark:border-purple-700/60 flex items-center justify-between text-xs font-extrabold text-[#5230B5] dark:text-purple-300 hover:bg-[#6741D9]/15 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Dices size={15} className="shrink-0" />
                        <span>Sınıf Kura Çarkı</span>
                      </span>
                      <span className="text-[11px] font-bold">
                        {pickerOpen ? "Açık" : "Aç"}
                      </span>
                    </button>
                  </div>

                  {/* 1. Tema Seçimi (Açık / Koyu Tema) */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleTheme();
                      playClick();
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-between text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {isDark ? (
                        <Sun size={15} className="text-amber-400 shrink-0" />
                      ) : (
                        <Moon size={15} className="text-[#6741D9] shrink-0" />
                      )}
                      <span>Tema Seçimi</span>
                    </span>
                    <span className="text-[11px] font-extrabold text-[#065F46] dark:text-emerald-300">
                      {isDark ? "Koyu Tema" : "Açık Tema"}
                    </span>
                  </button>

                  {/* 2. Seslendirme Hızı (0.5x – 1.5x) */}
                  <div className="px-3 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--foreground)]">
                      <span className="flex items-center gap-2">
                        <Gauge
                          size={15}
                          className="text-[#087F5B] dark:text-emerald-400 shrink-0"
                        />
                        <span>Seslendirme Hızı</span>
                      </span>
                      <span className="text-[11px] font-extrabold tabular-nums text-[#065F46] dark:text-emerald-300">
                        {mounted ? `${speechRate}x` : "1x"}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {SPEECH_RATE_OPTIONS.map((rate) => {
                        const active = (mounted ? speechRate : 1) === rate;
                        return (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => {
                              playClick();
                              setSpeechRate(rate);
                            }}
                            className={`py-1 rounded-lg text-[11px] font-extrabold tabular-nums border cursor-pointer transition-all ${
                              active
                                ? "bg-[#087F5B] border-[#065F46] text-white"
                                : "bg-white dark:bg-slate-900 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#087F5B]"
                            }`}
                          >
                            {rate}x
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2b. Seslendirici Tercihi (Erkek / Kadın) */}
                  <button
                    type="button"
                    onClick={() => {
                      togglePreferredVoiceGender();
                      playClick();
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-between text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Users
                        size={15}
                        className="text-[#087F5B] dark:text-emerald-400 shrink-0"
                      />
                      <span>Seslendirici Tercihi</span>
                    </span>
                    <span className="text-[11px] font-extrabold text-[#065F46] dark:text-emerald-300">
                      {mounted && preferredVoiceGender === "kadin"
                        ? "👩 Kadın Sesi"
                        : "👨 Erkek Sesi"}
                    </span>
                  </button>

                  {/* 2c. Gramer Anlatım Derinliği (Sade / Akademik) */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleGrammarDepthMode();
                      playClick();
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-between text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <GraduationCap
                        size={15}
                        className="text-[#6741D9] dark:text-purple-400 shrink-0"
                      />
                      <span>Gramer Anlatımı</span>
                    </span>
                    <span className="text-[11px] font-extrabold text-[#5230B5] dark:text-purple-300">
                      {mounted && grammarDepthMode === "simple"
                        ? "🌱 Sade Anlatım"
                        : "🎓 Akademik & İ'rab"}
                    </span>
                  </button>

                  {/* 3. Arayüz Ses Efektleri */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleSfx();
                      playClick();
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-between text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {mounted && sfxEnabled ? (
                        <Volume2
                          size={15}
                          className="text-[#087F5B] dark:text-emerald-400 shrink-0"
                        />
                      ) : (
                        <VolumeX
                          size={15}
                          className="text-[var(--muted)] shrink-0"
                        />
                      )}
                      <span>Arayüz Ses Efektleri</span>
                    </span>
                    <span
                      className={`text-[11px] font-extrabold ${
                        mounted && sfxEnabled
                          ? "text-[#065F46] dark:text-emerald-300"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {mounted && sfxEnabled ? "Açık" : "Kapalı"}
                    </span>
                  </button>

                  {/* 4. Kelime İpuçları */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleTooltips();
                      playClick();
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-between text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Lightbulb
                        size={15}
                        className="text-amber-600 dark:text-amber-400 shrink-0"
                      />
                      <span>Kelime İpuçları</span>
                    </span>
                    <span
                      className={`text-[11px] font-extrabold ${
                        mounted && showTooltips
                          ? "text-[#065F46] dark:text-emerald-300"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {mounted && showTooltips ? "Açık" : "Kapalı"}
                    </span>
                  </button>

                  {/* 5. Mikrofon Gürültü Engelleme + Mikrofon Testi */}
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        toggleMicNoiseSuppression();
                        playClick();
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-between text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <AudioLines
                          size={15}
                          className="text-[#087F5B] dark:text-emerald-400 shrink-0"
                        />
                        <span>Mikrofon Gürültü Engelleme</span>
                      </span>
                      <span
                        className={`text-[11px] font-extrabold ${
                          mounted && micNoiseSuppression
                            ? "text-[#065F46] dark:text-emerald-300"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {mounted && micNoiseSuppression ? "Açık" : "Kapalı"}
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          handleToggleMicModal();
                        }}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Mic size={14} className="text-[#087F5B] shrink-0" />
                        <span>Mikrofon Testi</span>
                      </button>

                      {/* 6. Tam Ekran (Aç / Kapat) */}
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          handleToggleFullscreen();
                        }}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isFullscreen ? (
                          <Minimize2 size={14} className="shrink-0" />
                        ) : (
                          <Maximize2 size={14} className="shrink-0" />
                        )}
                        <span>
                          {isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 7. Uygulama Rehberi (?) + Ayarlar + PWA Kurulum */}
                  <div className="pt-1.5 border-t border-[#E6D7BE]/80 dark:border-slate-800 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setMoreMenuOpen(false);
                          triggerGuideModal("quickstart");
                        }}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-purple-950/50 border border-[#6741D9]/50 text-xs font-bold text-[#6741D9] dark:text-purple-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <HelpCircle size={14} className="shrink-0" />
                        <span>Rehber (?)</span>
                      </button>

                      <Link
                        href="/ayarlar"
                        onClick={() => {
                          playClick();
                          setMoreMenuOpen(false);
                        }}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-xs font-bold text-[var(--foreground)] hover:border-[#087F5B] flex items-center justify-center gap-1.5"
                      >
                        <Settings size={14} className="shrink-0" />
                        <span>Tüm Ayarlar</span>
                      </Link>
                    </div>

                    {mounted && canInstall && (
                      <button
                        type="button"
                        onClick={async () => {
                          playClick();
                          setMoreMenuOpen(false);
                          if (isInstallable) {
                            await installApp();
                          } else if (isIOS) {
                            setIosInstallOpen(true);
                          }
                        }}
                        className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download size={14} className="shrink-0" />
                        <span>Uygulamayı Cihaza Kur</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {/* Sabit İnce Topbar İçin Görünmez Yer Tutucu (Spacer) */}
      <div
        aria-hidden="true"
        className="h-12 lg:h-14 w-full shrink-0 print:hidden"
      />

      {/* iOS KURULUM REHBERİ MODALI */}
      {iosInstallOpen && (
        <div className="fixed inset-0 z-[60] print:hidden flex items-center justify-center px-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-dashed border-[#E2D3B8] pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/icons/android-chrome-192x192.png"
                  alt="Logo"
                  className="w-8 h-8 object-contain rounded-lg"
                />
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  iPhone / iPad Ana Ekrana Ekle
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIosInstallOpen(false)}
                className="w-8 h-8 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] flex items-center justify-center text-[var(--muted)] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <p className="text-xs font-semibold text-[var(--foreground)] leading-relaxed">
              1. Safari alt çubuğundaki <strong>Paylaş</strong> simgesine dokunun.
              <br />
              2. Listeyi aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> seçeneğine basın.
            </p>
            <button
              type="button"
              onClick={() => setIosInstallOpen(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#087F5B] text-white text-xs font-bold border-b-4 border-[#065F46] cursor-pointer"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

      {/* MİKROFON TESTİ PANELİ */}
      {micModalOpen && (
        <div className="fixed inset-0 z-[60] print:hidden flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-dashed border-[#E2D3B8] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#087F5B] text-white flex items-center justify-center">
                  <Mic size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                    Mikrofon ve Ses Seviyesi Testi
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Gölgeleme çalışmaları öncesi mikrofonunuzu doğrulayın
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleMicModal}
                className="w-8 h-8 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Canlı Ses Seviyesi Çubuğu */}
            <div className="bg-white dark:bg-[var(--background)] rounded-xl p-4 border border-[#E6D7BE] dark:border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[var(--muted)]">Giriş Sinyali</span>
                <span className="tabular-nums text-[#065F46] dark:text-emerald-400">
                  %{micLevel}
                </span>
              </div>
              <div className="w-full h-3 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-full overflow-hidden border border-[#E6D7BE]">
                <div
                  className="h-full bg-[#087F5B] transition-all duration-75 rounded-full"
                  style={{ width: `${micLevel}%` }}
                />
              </div>
              {micStatus === "error" ? (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/60 border-2 border-red-500 p-3 flex items-center gap-2 text-xs font-extrabold text-red-700 dark:text-red-200">
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                  <span>{micMessage}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {micStatus === "ok" && (
                    <CheckCircle2
                      size={16}
                      className="text-[#065F46] dark:text-emerald-400 shrink-0"
                    />
                  )}
                  <span
                    className={
                      micStatus === "ok"
                        ? "text-[#065F46] dark:text-emerald-400"
                        : "text-[var(--muted)]"
                    }
                  >
                    {micMessage}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startMicTest}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#FDFBF7] active:border-b-2 active:translate-y-0.5 transition-all cursor-pointer"
              >
                Yeniden Test Et
              </button>
              <button
                type="button"
                onClick={handleToggleMicModal}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-bold border-b-4 border-[#065F46] active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}