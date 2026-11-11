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
  Languages,
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
  SlidersHorizontal,
  Lightbulb,
} from "lucide-react";
import { useSfxStore } from "@/store/sfxStore";
import { useSettings, ViewMode } from "@/store/settings";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";
import { playClick, playSuccess } from "@/lib/sfxManager";
import { usePwaInstall } from "@/lib/usePwaInstall";
import {
  getArabicFontConfig,
  ARABIC_FONT_SIZE_PRESETS,
} from "@/lib/arabicTextUtils";
import { triggerGuideModal } from "@/components/ui/GuideAndInfoModal";
import { getDynamicContentStats } from "@/lib/data";
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
    cycleSpeechRate,
    arabicFont,
    arabicFontSize,
    arabicFontSizePreset,
    setArabicFontSizePreset,
    showTooltips,
    toggleTooltips,
  } = useSettings();
  const { isOpen: smartboardOpen, toggleToolbar: toggleSmartboardToolbar } =
    useClassroomToolsStore();
  const { isInstallable, isInstalled, isIOS, installApp } = usePwaInstall();

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iosInstallOpen, setIosInstallOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileToolsRef = useRef<HTMLDivElement | null>(null);

  // Mikrofon Testi Modal/Popover State & İzin Yarışı Koruması
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
    const cfg = getArabicFontConfig(arabicFont);
    const ratio = Number(((arabicFontSize / 34) * cfg.scale).toFixed(3));
    document.documentElement.style.setProperty(
      "--font-arabic-family",
      cfg.cssFamily
    );
    document.documentElement.style.setProperty(
      "--font-arabic-scale",
      String(cfg.scale)
    );
    document.documentElement.style.setProperty(
      "--font-arabic-line-height",
      String(cfg.lineHeight)
    );
    document.documentElement.style.setProperty(
      "--font-arabic-size-px",
      `${arabicFontSize}px`
    );
    document.documentElement.style.setProperty(
      "--font-arabic-size-ratio",
      String(ratio)
    );
  }, [arabicFont, arabicFontSize]);

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
        viewMenuRef.current &&
        !viewMenuRef.current.contains(e.target as Node)
      ) {
        setViewMenuOpen(false);
      }
      if (
        mobileToolsRef.current &&
        !mobileToolsRef.current.contains(e.target as Node)
      ) {
        setMobileToolsOpen(false);
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
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      isMountedRef.current = false;
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("mousedown", handleClickOutside);
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
      const { micNoiseSuppression } = useSettings.getState();
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: Boolean(micNoiseSuppression),
            noiseSuppression: Boolean(micNoiseSuppression),
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

  const contentStats = getDynamicContentStats();

  const navLinks = [
    {
      href: "/",
      label: "Ana Sayfa",
      shortLabel: "Ana Sayfa",
      Icon: Home,
      tooltip: "Günlük Çalışma Planı ve Modül Merkezi",
    },
    {
      href: "/kutuphane",
      label: "Kütüphane",
      shortLabel: "Kütüphane",
      Icon: BookOpen,
      tooltip: `Eğitim Kütüphanesi Vitrini (${contentStats.dialogueCount} Diyalog, ${contentStats.readingCount} Metin, ${contentStats.sentenceCount} Cümle, ${contentStats.proverbCount} Atasözü, ${contentStats.visualWordCount} Görsel Kelime)`,
    },
    {
      href: "/alistirmalar",
      label: "Alıştırmalar",
      shortLabel: "Alıştırmalar",
      Icon: Gamepad2,
      tooltip: "14 Farklı Etkileşimli Kelime, Cümle, İ'rab ve Oyun Alıştırması",
    },
    {
      href: "/seviye-tespit",
      label: "Seviye & Tarama",
      shortLabel: "Seviye",
      Icon: Compass,
      tooltip: "Adaptif Seviye Tespit Sınavı, 13 Konu Tarama ve Kur Bitirme Merkezi (180 Soru)",
    },
    {
      href: "/sozluk",
      label: "Sözlük",
      shortLabel: "Sözlük",
      Icon: BookMarked,
      tooltip: `Morfolojik Kök Ailesi ve Sesli Arapça-Türkçe Sözlük (${contentStats.dictionaryWordCount} Kelime)`,
    },
    {
      href: "/ayarlar",
      label: "Ayarlar",
      shortLabel: "Ayarlar",
      Icon: Settings,
      tooltip: "Yazı Boyutu, Ses Motoru, Yedekleme ve Çevrimdışı Paket Ayarları",
    },
  ];

  const activeHarekeMode = !mounted
    ? "full"
    : harekeMode || (showHareke ? "full" : "none");
  const harekeShortLabel =
    activeHarekeMode === "full"
      ? "Tam"
      : activeHarekeMode === "irab-only"
      ? "İ'rab"
      : "Kapalı";
  const currentViewMode: ViewMode = mounted ? viewMode : "stacked";
  const isDark = mounted && theme === "dark";
  const canInstall = (isInstallable || isIOS) && !isInstalled;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 print:hidden w-full h-12 py-1.5 pt-[env(safe-area-inset-top)] bg-[#FDFBF7]/95 dark:bg-[var(--background)]/95 backdrop-blur-md border-b-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-xs flex items-center">
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-3 xl:px-6 h-full flex items-center justify-between gap-1.5 lg:gap-2 min-w-0">
          {/* =============================================================== */}
          {/* 1. BÖLGE (SOL): Logo + Başlık + PWA Kur Butonu (Asla Çakışmaz)  */}
          {/* =============================================================== */}
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              onClick={() => playClick()}
              className="flex items-center gap-1.5 sm:gap-2 group shrink-0"
              data-tooltip="Ana Sayfaya Dön"
              data-tooltip-pos="bottom"
              data-tooltip-align="left"
              aria-label="Ana Sayfaya Dön"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center justify-center shrink-0 group-active:translate-y-0.5 transition-transform p-0.5">
                <img
                  src="/icons/android-chrome-192x192.png"
                  alt="Logo"
                  className="w-6 h-6 object-contain rounded-lg"
                />
              </div>
              <span className="md:hidden text-xs font-extrabold tracking-tight text-[var(--foreground)] whitespace-nowrap leading-tight">
                Arapça Telaffuz
              </span>
              <span className="hidden 2xl:block text-xs xl:text-sm font-extrabold tracking-tight text-[var(--foreground)] whitespace-nowrap leading-tight">
                Arapça Telaffuz &amp; Diyalog
              </span>
            </Link>

            {/* PWA Uygulamayı Kur Butonu (Logonun sağında temiz blok, asla üstüne binmez) */}
            {mounted && canInstall && (
              <button
                type="button"
                onClick={async () => {
                  playClick();
                  if (isInstallable) {
                    await installApp();
                  } else if (isIOS) {
                    setIosInstallOpen(true);
                  }
                }}
                data-tooltip="Uygulamayı Cihazınıza Yükleyin (İnternetsiz Çalışma Desteği)"
                data-tooltip-pos="bottom"
                data-tooltip-align="left"
                aria-label="Uygulamayı Cihaza Kur"
                className="hidden md:inline-flex min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] 2xl:px-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-3 border-[#065F46] active:border-b-0 active:translate-y-0.5 transition-all items-center justify-center gap-1 text-xs font-extrabold cursor-pointer shrink-0"
              >
                <Download size={14} className="shrink-0" />
                <span className="hidden 2xl:inline">Kur</span>
              </button>
            )}
          </div>

          {/* =============================================================== */}
          {/* 2. BÖLGE (ORTA): Esnek Masaüstü Navigasyon (Sıfır Absolute!)    */}
          {/* =============================================================== */}
          <nav
            aria-label="Ana Navigasyon"
            className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1 min-w-0 bg-slate-200/55 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700/60"
          >
            {navLinks.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const NavIcon = item.Icon;
              const hasShort = item.shortLabel !== item.label;
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
                  data-tooltip={item.tooltip}
                  data-tooltip-pos="bottom"
                  className={
                    isActive
                      ? "px-2 xl:px-2.5 py-1.5 text-xs xl:text-[13px] rounded-lg font-bold bg-[#087F5B] text-white shadow-sm flex items-center gap-1 xl:gap-1.5 whitespace-nowrap transition-all shrink-0"
                      : "px-2 xl:px-2.5 py-1.5 text-xs xl:text-[13px] rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/60 hover:text-[#065F46] transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0"
                  }
                >
                  <NavIcon className="w-3.5 h-3.5 shrink-0" />
                  {hasShort ? (
                    <>
                      <span className="hidden xl:inline">{item.label}</span>
                      <span className="xl:hidden">{item.shortLabel}</span>
                    </>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* =============================================================== */}
          {/* 3. BÖLGE (SAĞ): Hızlı Kontroller + Dar/Orta Ekran Araçlar Menüsü*/}
          {/* =============================================================== */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* 1. 3 Kademeli Hareke Modu (Masaüstü/Tablet md+) */}
            <button
              type="button"
              onClick={() => {
                cycleHarekeMode();
                playClick();
              }}
              data-tooltip={`Hareke Modu: ${
                activeHarekeMode === "full"
                  ? "Tam Harekeli"
                  : activeHarekeMode === "irab-only"
                  ? "Hareke Solması (Sadece Son İ'rab & Şedde)"
                  : "Harekesiz (Üzerine Gelince Açılır)"
              } — Değiştirmek için tıklayın`}
              data-tooltip-pos="bottom"
              aria-label="Hareke Modunu Değiştir"
              className={`hidden md:flex group relative min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] px-2 rounded-xl border-2 border-b-3 items-center justify-center gap-1 active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                activeHarekeMode === "full"
                  ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-400"
                  : activeHarekeMode === "irab-only"
                  ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] opacity-80"
              }`}
            >
              <Sparkles size={13} strokeWidth={2.4} className="shrink-0" />
              <span className="hidden xl:inline text-[10px] font-black">
                {harekeShortLabel}
              </span>
            </button>

            {/* 2. Çeviri Görünümü & Yazı Boyutu Popover (Masaüstü/Tablet md+) */}
            <div className="hidden md:block relative shrink-0" ref={viewMenuRef}>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setViewMenuOpen((o) => !o);
                }}
                data-tooltip="Çeviri Görünümü ve Arapça Yazı Boyutu"
                data-tooltip-pos="bottom"
                aria-label="Çeviri Görünümü ve Arapça Yazı Boyutu"
                className={`group relative min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] rounded-xl border-2 border-b-3 flex items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer ${
                  currentViewMode !== "arabic-only"
                    ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-400"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                <Languages size={14} strokeWidth={2.4} />
              </button>

              {viewMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-68 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-2.5 shadow-2xl z-50 space-y-2">
                  <div className="space-y-1">
                    <span className="block px-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      Arapça Yazı Boyutu
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
                            className={`py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                              active
                                ? "bg-[#087F5B] border-[#065F46] text-white"
                                : "bg-white/80 dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1 pt-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                    <span>Çeviri Görünüm Modu</span>
                  </div>
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
                              setViewMenuOpen(false);
                            }}
                            className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                              active
                                ? "bg-[#087F5B] text-white"
                                : "text-[var(--foreground)] hover:bg-white/70 dark:hover:bg-[var(--background)]"
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
              )}
            </div>

            {/* 3. TTS Okuma Hızı (Mobilde ve 2xl+ Geniş Masaüstünde Doğrudan, Orta Laptopta Araçlar İçinde) */}
            <button
              type="button"
              onClick={() => {
                cycleSpeechRate();
                playClick();
              }}
              data-tooltip="Seslendirme Hızını Değiştir (0.5x – 1.5x)"
              data-tooltip-pos="bottom"
              aria-label="Seslendirme Hızını Değiştir"
              className="md:hidden 2xl:inline-flex group relative h-9 min-w-[36px] sm:min-w-[38px] sm:min-h-[38px] px-2 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] md:border-2 md:border-b-3 dark:border-[var(--border)] flex items-center justify-center gap-1 text-[var(--foreground)] hover:bg-[#EFE3CE] active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
              <Gauge
                size={13}
                className="hidden 2xl:inline text-[#065F46] dark:text-emerald-400 shrink-0"
              />
              <span className="text-[11px] font-extrabold tabular-nums">
                {mounted ? `${speechRate}x` : "1x"}
              </span>
            </button>

            {/* 4. Tema Değiştirici (Tüm Ekranlarda Sabit) */}
            <button
              type="button"
              onClick={() => {
                toggleTheme();
                playClick();
              }}
              data-tooltip="Gece / Gündüz Görünüm Modunu Değiştir"
              data-tooltip-pos="bottom"
              aria-label="Gece / Gündüz Görünüm Modunu Değiştir"
              className="group relative h-9 w-9 sm:min-w-[38px] sm:min-h-[38px] rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] md:border-2 md:border-b-3 dark:border-[var(--border)] flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
              {isDark ? (
                <Sun size={15} strokeWidth={2.4} className="text-amber-400" />
              ) : (
                <Moon size={15} strokeWidth={2.4} className="text-[#6741D9]" />
              )}
            </button>

            {/* 5. Akıllı Tahta Kalemi & Sınıf Araçları (Masaüstü/Tablet md+) */}
            <button
              type="button"
              onClick={() => {
                playClick();
                toggleSmartboardToolbar();
              }}
              data-tooltip="🖍️ Tahta Kalemi, Şekiller, Perde, Kura & Sayaç"
              data-tooltip-pos="bottom"
              data-tooltip-align="right"
              aria-label="Tahta Kalemi ve Sınıf Araçları"
              className={`hidden md:flex group relative min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] rounded-xl border-2 border-b-3 items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                smartboardOpen
                  ? "bg-[#087F5B] border-[#065F46] text-white"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:bg-[#EFE3CE]"
              }`}
            >
              <PenTool size={14} strokeWidth={2.4} />
            </button>

            {/* 6. Kullanım Kılavuzu & İnfo [❓] (Masaüstü/Tablet md+) */}
            <button
              type="button"
              onClick={() => {
                playClick();
                triggerGuideModal("quickstart");
              }}
              data-tooltip="Uygulama Kullanım Rehberi ve İletişim / Hata Bildirimi"
              data-tooltip-pos="bottom"
              data-tooltip-align="right"
              aria-label="Uygulama Kullanım Rehberi"
              className="hidden md:flex group relative min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] rounded-xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-2 border-[#6741D9] border-b-3 items-center justify-center text-[#6741D9] dark:text-[#d0bfff] hover:bg-[#e8e2ff] active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
              <HelpCircle size={14} strokeWidth={2.4} />
            </button>

            {/* 7. Geniş Masaüstü (2xl+) İkincil Butonlar: Efekt, Mikrofon, Tam Ekran */}
            <button
              type="button"
              onClick={() => {
                toggleSfx();
                playClick();
              }}
              data-tooltip="Arayüz Ses Efektlerini Aç / Kapat"
              data-tooltip-pos="bottom"
              aria-label="Arayüz Ses Efektlerini Aç / Kapat"
              className={`group relative hidden 2xl:inline-flex min-w-[38px] min-h-[38px] rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 items-center justify-center hover:bg-[#EFE3CE] active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                mounted && sfxEnabled
                  ? "text-[#065F46] dark:text-emerald-400"
                  : "text-[var(--muted)] opacity-75"
              }`}
            >
              {mounted && sfxEnabled ? (
                <Volume2 size={14} strokeWidth={2.4} />
              ) : (
                <VolumeX size={14} strokeWidth={2.4} />
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleMicModal}
              data-tooltip="Mikrofon ve Ses Seviyesi Testi"
              data-tooltip-pos="bottom"
              data-tooltip-align="right"
              aria-label="Mikrofon Testi"
              className={`hidden 2xl:flex group relative min-w-[38px] min-h-[38px] rounded-xl border-2 border-b-3 items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                micModalOpen
                  ? "bg-[#F3F0FF] border-[#6741D9] text-[#6741D9]"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:bg-[#EFE3CE]"
              }`}
            >
              <Mic size={14} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              data-tooltip="Tam Ekran Moduna Geç / Çık"
              data-tooltip-pos="bottom"
              data-tooltip-align="right"
              aria-label="Tam Ekran Moduna Geç / Çık"
              className="group relative hidden 2xl:inline-flex min-w-[38px] min-h-[38px] rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] active:border-b-1 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
              {isFullscreen ? (
                <Minimize2 size={14} strokeWidth={2.4} />
              ) : (
                <Maximize2 size={14} strokeWidth={2.4} />
              )}
            </button>

            {/* 8. KOMPAKT [🎛️ Araçlar] Açılır Menüsü (Mobil < md VE Orta Ekran Laptop md..2xl için taşma önleyici) */}
            <div className="relative 2xl:hidden shrink-0" ref={mobileToolsRef}>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setMobileToolsOpen((prev) => !prev);
                }}
                data-tooltip="Hız, Ses Efekti, Mikrofon, İpucu ve Tam Ekran Araçları"
                data-tooltip-pos="bottom"
                data-tooltip-align="right"
                aria-label="Görünüm ve Hızlı Araçlar Menüsü"
                className={`h-9 md:min-h-[38px] px-2 sm:px-2.5 rounded-xl border md:border-2 md:border-b-3 flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 ${
                  mobileToolsOpen
                    ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:bg-[#EFE3CE]"
                }`}
              >
                <SlidersHorizontal
                  size={14}
                  strokeWidth={2.4}
                  className="shrink-0"
                />
                <span className="hidden min-[360px]:inline md:hidden xl:inline text-[11px] font-extrabold">
                  Araçlar
                </span>
              </button>

              {mobileToolsOpen && (
                <div className="fixed md:absolute right-2.5 md:right-0 left-2.5 md:left-auto top-13 md:top-full md:mt-2 md:w-80 max-w-sm ml-auto rounded-2xl bg-[#FDFBF7] dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 border-b-4 p-3 shadow-2xl z-50 space-y-2.5 max-h-[82dvh] overflow-y-auto">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E6D7BE]/80 dark:border-slate-800">
                    <span className="text-xs font-extrabold text-[var(--foreground)]">
                      🎛️ Hızlı Araçlar &amp; Görünüm
                    </span>
                    <button
                      type="button"
                      onClick={() => setMobileToolsOpen(false)}
                      className="w-6 h-6 rounded-lg bg-[#F7EFE1] dark:bg-slate-800 flex items-center justify-center text-[var(--muted)] cursor-pointer"
                      aria-label="Menüyü Kapat"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* İkincil Hızlı Anahtarlar: Okuma Hızı, Ses Efekti, Kelime İpucu */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        cycleSpeechRate();
                        playClick();
                      }}
                      className="px-2 py-2 rounded-xl border bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer text-[var(--foreground)]"
                    >
                      <span className="flex items-center gap-1">
                        <Gauge size={12} className="text-[#087F5B]" />
                        <span>Hız</span>
                      </span>
                      <span className="text-[10px] font-extrabold tabular-nums text-[#065F46] dark:text-emerald-300">
                        {mounted ? `${speechRate}x` : "1x"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        toggleSfx();
                        playClick();
                      }}
                      className={`px-2 py-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        mounted && sfxEnabled
                          ? "bg-emerald-500/15 border-[#087F5B] text-[#065F46] dark:text-emerald-300"
                          : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--muted)]"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {mounted && sfxEnabled ? (
                          <Volume2 size={12} />
                        ) : (
                          <VolumeX size={12} />
                        )}
                        <span>Efekt</span>
                      </span>
                      <span className="text-[10px] font-extrabold">
                        {mounted && sfxEnabled ? "Açık" : "Kapalı"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        toggleTooltips();
                        playClick();
                      }}
                      className={`px-2 py-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        mounted && showTooltips
                          ? "bg-emerald-500/15 border-[#087F5B] text-[#065F46] dark:text-emerald-300"
                          : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--muted)]"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Lightbulb size={12} />
                        <span>İpucu</span>
                      </span>
                      <span className="text-[10px] font-extrabold">
                        {mounted && showTooltips ? "Açık" : "Kapalı"}
                      </span>
                    </button>
                  </div>

                  {/* Mobilde ek olarak Hareke & Çeviri Görünüm Seçici */}
                  <div className="md:hidden space-y-2 pt-1 border-t border-[#E6D7BE]/80 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          cycleHarekeMode();
                          playClick();
                        }}
                        className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-between cursor-pointer ${
                          activeHarekeMode === "full"
                            ? "bg-emerald-500/15 border-[#087F5B] text-[#065F46] dark:text-emerald-300"
                            : activeHarekeMode === "irab-only"
                            ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300"
                            : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--muted)]"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <Sparkles size={12} />
                          <span>Hareke</span>
                        </span>
                        <span className="text-[10px] font-extrabold">
                          {harekeShortLabel}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setViewMode(
                            currentViewMode === "arabic-only"
                              ? "stacked"
                              : "arabic-only"
                          );
                        }}
                        className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-between cursor-pointer ${
                          currentViewMode !== "arabic-only"
                            ? "bg-emerald-500/15 border-[#087F5B] text-[#065F46] dark:text-emerald-300"
                            : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--muted)]"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <Languages size={12} />
                          <span>Çeviri</span>
                        </span>
                        <span className="text-[10px] font-extrabold">
                          {currentViewMode !== "arabic-only" ? "Açık" : "Kapalı"}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <span className="block px-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                        Çeviri &amp; Metin Görünümü
                      </span>
                      <div className="grid grid-cols-1 gap-1">
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
                                  setMobileToolsOpen(false);
                                }}
                                className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer ${
                                  active
                                    ? "bg-[#087F5B] text-white"
                                    : "bg-[#F7EFE1]/80 dark:bg-slate-800/80 text-[var(--foreground)]"
                                }`}
                              >
                                <span>{VIEW_MODE_LABELS[mode]}</span>
                                {active && <Check size={13} strokeWidth={3} />}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mikrofon Testi, Tam Ekran ve Mobil Kısayollar */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#E6D7BE]/80 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileToolsOpen(false);
                        handleToggleMicModal();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-xs font-bold text-[var(--foreground)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mic size={13} className="text-[#087F5B] shrink-0" />
                      <span>Mikrofon Testi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileToolsOpen(false);
                        handleToggleFullscreen();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-xs font-bold text-[var(--foreground)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isFullscreen ? (
                        <Minimize2 size={13} className="shrink-0" />
                      ) : (
                        <Maximize2 size={13} className="shrink-0" />
                      )}
                      <span>{isFullscreen ? "Küçült" : "Tam Ekran"}</span>
                    </button>

                    <Link
                      href="/seviye-tespit"
                      onClick={() => {
                        playClick();
                        setMobileToolsOpen(false);
                      }}
                      className="lg:hidden col-span-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#087F5B] to-teal-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Compass size={14} className="shrink-0" />
                      <span>🧭 Seviye Tespit &amp; 13 Konu Tarama</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setMobileToolsOpen(false);
                        toggleSmartboardToolbar();
                      }}
                      className={`md:hidden col-span-2 px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                        smartboardOpen
                          ? "bg-[#6741D9] border-[#5230B5] text-white"
                          : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)]"
                      }`}
                    >
                      <PenTool size={13} className="shrink-0" />
                      <span>
                        🖍️ Tahta Kalemi &amp; Araçlar{" "}
                        {smartboardOpen ? "(Açık)" : ""}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setMobileToolsOpen(false);
                        triggerGuideModal("quickstart");
                      }}
                      className="md:hidden col-span-2 px-2.5 py-2 rounded-xl bg-[#F3F0FF] dark:bg-purple-950/50 border border-[#6741D9]/50 text-xs font-bold text-[#6741D9] dark:text-purple-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <HelpCircle size={13} />
                      <span>Uygulama Kullanım Rehberi (?)</span>
                    </button>

                    {mounted && canInstall && (
                      <button
                        type="button"
                        onClick={async () => {
                          playClick();
                          setMobileToolsOpen(false);
                          if (isInstallable) {
                            await installApp();
                          } else if (isIOS) {
                            setIosInstallOpen(true);
                          }
                        }}
                        className="md:hidden col-span-2 px-3 py-2 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download size={14} />
                        <span>Uygulamayı Cihaza Yükle (Kur)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 9. Ayarlar Kısayolu (Tabletlerde hızlı erişim: hidden md:flex lg:hidden) */}
            <Link
              href="/ayarlar"
              onClick={() => playClick()}
              data-tooltip="Yazı Boyutu, Ses Motoru, Yedekleme ve Çevrimdışı Paket Ayarları"
              data-tooltip-pos="bottom"
              data-tooltip-align="right"
              aria-label="Ayarlar"
              className={`hidden md:flex lg:hidden min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] rounded-xl border-2 border-b-3 items-center justify-center active:border-b-1 active:translate-y-0.5 transition-all shrink-0 ${
                pathname === "/ayarlar"
                  ? "bg-[#F3F0FF] border-[#6741D9] text-[#6741D9]"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
              }`}
            >
              <Settings size={14} strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </header>
      {/* Sabit İnce Topbar İçin Görünmez Yer Tutucu (Spacer) */}
      <div
        aria-hidden="true"
        className="h-12 w-full shrink-0 print:hidden"
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
                className="w-8 h-8 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] flex items-center justify-center text-[var(--muted)]"
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
              className="w-full py-2.5 px-4 rounded-xl bg-[#087F5B] text-white text-xs font-bold border-b-4 border-[#065F46]"
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
                className="w-8 h-8 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Canlı Ses Seviyesi Çubuğu */}
            <div className="bg-white dark:bg-[var(--background)] rounded-xl p-4 border border-[#E6D7BE] dark:border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[var(--muted)]">Giriş Sinyali</span>
                <span className="tabular-nums text-[#065F46] dark:text-emerald-400">%{micLevel}</span>
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
                className="flex-1 py-2.5 px-4 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#FDFBF7] active:border-b-2 active:translate-y-0.5 transition-all"
              >
                Yeniden Test Et
              </button>
              <button
                type="button"
                onClick={handleToggleMicModal}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-bold border-b-4 border-[#065F46] active:border-b-0 active:translate-y-1 transition-all"
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