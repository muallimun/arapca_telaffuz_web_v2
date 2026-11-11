"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MousePointer2,
  PenTool,
  Highlighter,
  MoveUpRight,
  Eraser,
  Undo2,
  Trash2,
  Blinds,
  Dices,
  Timer,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  RotateCcw,
  GripHorizontal,
  ArrowLeftRight,
  ArrowUpDown,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Users,
  Sparkles,
} from "lucide-react";
import {
  useClassroomToolsStore,
  SmartboardTool,
  IrabSemanticColorId,
  PenWidthPreset,
  DockReachZone,
} from "@/store/classroomToolsStore";
import { useSettings } from "@/store/settings";
import { playClick, playSuccess, playFlip } from "@/lib/sfxManager";

export interface SemanticColorOption {
  id: IrabSemanticColorId;
  hex: string;
  highlighterHex: string;
  badgeDot: string;
  shortLabel: string;
  pedagogicalRole: string;
}

export const IRAB_SEMANTIC_PALETTE: SemanticColorOption[] = [
  {
    id: "merfu",
    hex: "#059669",
    highlighterHex: "#34D399",
    badgeDot: "🟢",
    shortLabel: "Merfû",
    pedagogicalRole: "Özne / Merfû",
  },
  {
    id: "mansub",
    hex: "#E11D48",
    highlighterHex: "#FB7185",
    badgeDot: "🔴",
    shortLabel: "Mansûb",
    pedagogicalRole: "Nesne / Mansûb",
  },
  {
    id: "mecrur",
    hex: "#2563EB",
    highlighterHex: "#60A5FA",
    badgeDot: "🔵",
    shortLabel: "Mecrûr",
    pedagogicalRole: "Mecrûr / Tamlayan",
  },
  {
    id: "haber",
    hex: "#D97706",
    highlighterHex: "#FBBF24",
    badgeDot: "🟡",
    shortLabel: "Haber/Sıfat",
    pedagogicalRole: "Haber / Sıfat",
  },
  {
    id: "fiil",
    hex: "#7C3AED",
    highlighterHex: "#A78BFA",
    badgeDot: "🟣",
    shortLabel: "Fiil/Edat",
    pedagogicalRole: "Fiil / Edat",
  },
];

const PEN_WIDTH_PX: Record<PenWidthPreset, number> = {
  thin: 3,
  medium: 5.5,
  thick: 9.5,
};

interface Point2D {
  x: number;
  y: number;
}

interface DrawingElement {
  id: string;
  kind: "pen" | "highlighter" | "arrow";
  colorId: IrabSemanticColorId;
  colorHex: string;
  strokeWidth: number;
  points: Point2D[];
}

const ROSTER_STORAGE_KEY = "muallimun_classroom_roster_v1";
const ROSTER_RANGE_KEY = "muallimun_classroom_range_v1";

function buildSmoothSvgPath(points: Point2D[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.5).toFixed(1)} ${(p.y + 0.5).toFixed(1)}`;
  }
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function distanceToSegmentSquared(p: Point2D, v: Point2D, w: Point2D): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return (p.x - projX) ** 2 + (p.y - projY) ** 2;
}

function hitTestElement(el: DrawingElement, pt: Point2D, radius = 22): boolean {
  const thresholdSq = (radius + el.strokeWidth * 0.5) ** 2;
  if (el.points.length === 1) {
    const dSq = (pt.x - el.points[0].x) ** 2 + (pt.y - el.points[0].y) ** 2;
    return dSq <= thresholdSq;
  }
  for (let i = 0; i < el.points.length - 1; i++) {
    if (
      distanceToSegmentSquared(pt, el.points[i], el.points[i + 1]) <=
      thresholdSq
    ) {
      return true;
    }
  }
  return false;
}

function formatTimerClock(totalSec: number): string {
  const mins = Math.floor(Math.max(0, totalSec) / 60);
  const secs = Math.max(0, totalSec) % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function SmartboardOverlay() {
  const {
    isOpen,
    isCollapsed,
    activeTool,
    activeColorId,
    penWidth,
    dockZone,
    curtainOpen,
    curtainRatio,
    curtainAxis,
    pickerOpen,
    timerOpen,
    closeToolbar,
    setCollapsed,
    setActiveTool,
    setActiveColorId,
    setPenWidth,
    setDockZone,
    toggleCurtain,
    setCurtainOpen,
    setCurtainRatio,
    setCurtainAxis,
    setPickerOpen,
    togglePicker,
    setTimerOpen,
    toggleTimer,
  } = useClassroomToolsStore();

  const { theme } = useSettings();
  const isDark = theme === "dark";

  // Çizim elemanları yığını
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [draftElement, setDraftElement] = useState<DrawingElement | null>(null);
  const isPointerDrawingRef = useRef(false);

  // Perde sürükleme referansı
  const isDraggingCurtainRef = useRef(false);

  // 🎡 Sınıf Kura Çarkı State'leri (Sadece localStorage, sunucuya gitmez)
  const [pickerMode, setPickerMode] = useState<"numbers" | "names">("numbers");
  const [rangeStart, setRangeStart] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = localStorage.getItem(ROSTER_RANGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.start === "number") return parsed.start;
      }
    } catch {
      // ignore
    }
    return 1;
  });
  const [rangeEnd, setRangeEnd] = useState<number>(() => {
    if (typeof window === "undefined") return 35;
    try {
      const saved = localStorage.getItem(ROSTER_RANGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.end === "number") return parsed.end;
      }
    } catch {
      // ignore
    }
    return 35;
  });
  const [rosterText, setRosterText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(ROSTER_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [avoidRepeatInLesson, setAvoidRepeatInLesson] = useState<boolean>(true);
  const [pickedHistory, setPickedHistory] = useState<string[]>([]);
  const [currentPickedStudent, setCurrentPickedStudent] = useState<
    string | null
  >(null);
  const [rollingCandidate, setRollingCandidate] = useState<string | null>(null);
  const [isRollingPicker, setIsRollingPicker] = useState<boolean>(false);
  const pickerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⏱️ Ders Zamanlayıcısı (Geri Sayım / Kronometre) State'leri
  const [timerMode, setTimerMode] = useState<"countdown" | "stopwatch">(
    "countdown"
  );
  const [presetSeconds, setPresetSeconds] = useState<number>(60);
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerFinishedFlash, setTimerFinishedFlash] = useState<boolean>(false);

  const selectedColorObj = useMemo(
    () =>
      IRAB_SEMANTIC_PALETTE.find((c) => c.id === activeColorId) ||
      IRAB_SEMANTIC_PALETTE[0],
    [activeColorId]
  );

  // Sınıf listesini ve numara aralığını localStorage'da güncelle
  const handleRosterTextChange = (val: string) => {
    setRosterText(val);
    try {
      if (val.trim()) {
        localStorage.setItem(ROSTER_STORAGE_KEY, val);
      } else {
        localStorage.removeItem(ROSTER_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  };

  const handleClearRoster = () => {
    playClick();
    setRosterText("");
    setPickedHistory([]);
    setCurrentPickedStudent(null);
    try {
      localStorage.removeItem(ROSTER_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const updateNumberRange = (nextStart: number, nextEnd: number) => {
    const safeStart = Math.max(1, Math.min(200, nextStart || 1));
    const safeEnd = Math.max(safeStart, Math.min(200, nextEnd || safeStart));
    setRangeStart(safeStart);
    setRangeEnd(safeEnd);
    try {
      localStorage.setItem(
        ROSTER_RANGE_KEY,
        JSON.stringify({ start: safeStart, end: safeEnd })
      );
    } catch {
      // ignore
    }
  };

  const fullCandidatePool = useMemo(() => {
    if (pickerMode === "names") {
      return rosterText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }
    const list: string[] = [];
    const lo = Math.min(rangeStart, rangeEnd);
    const hi = Math.max(rangeStart, rangeEnd);
    for (let n = lo; n <= hi; n++) {
      list.push(`Öğrenci #${n}`);
    }
    return list;
  }, [pickerMode, rosterText, rangeStart, rangeEnd]);

  const remainingCandidates = useMemo(() => {
    if (!avoidRepeatInLesson) return fullCandidatePool;
    const pickedSet = new Set(pickedHistory);
    return fullCandidatePool.filter((c) => !pickedSet.has(c));
  }, [fullCandidatePool, avoidRepeatInLesson, pickedHistory]);

  useEffect(() => {
    return () => {
      if (pickerTimeoutRef.current) {
        clearTimeout(pickerTimeoutRef.current);
      }
    };
  }, []);

  // ⏱️ Ders Zamanlayıcısı Tiki (setState yalnızca setTimeout callback içinde!)
  useEffect(() => {
    if (!timerRunning) return;
    const handle = setTimeout(() => {
      if (timerMode === "countdown") {
        if (timerSeconds <= 1) {
          setTimerSeconds(0);
          setTimerRunning(false);
          setTimerFinishedFlash(true);
          playSuccess();
        } else {
          setTimerSeconds((prev) => prev - 1);
        }
      } else {
        setTimerSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearTimeout(handle);
  }, [timerRunning, timerSeconds, timerMode]);

  const handleSelectCountdownPreset = (sec: number) => {
    playClick();
    setTimerMode("countdown");
    setPresetSeconds(sec);
    setTimerSeconds(sec);
    setTimerRunning(false);
    setTimerFinishedFlash(false);
  };

  const handleSwitchStopwatch = () => {
    playClick();
    setTimerMode("stopwatch");
    setTimerSeconds(0);
    setTimerRunning(false);
    setTimerFinishedFlash(false);
  };

  const handleResetTimer = () => {
    playClick();
    setTimerRunning(false);
    setTimerFinishedFlash(false);
    setTimerSeconds(timerMode === "countdown" ? presetSeconds : 0);
  };

  // 🎲 Kura Çarkı Animasyonlu Seçim
  const handlePickRandomStudent = () => {
    if (isRollingPicker || fullCandidatePool.length === 0) return;

    let workingPool = remainingCandidates;
    let resetTriggered = false;
    if (avoidRepeatInLesson && workingPool.length === 0) {
      workingPool = fullCandidatePool;
      resetTriggered = true;
    }

    if (workingPool.length === 0) return;

    setIsRollingPicker(true);
    setCurrentPickedStudent(null);

    const totalSteps = Math.min(14, Math.max(8, workingPool.length + 5));
    const winnerIndex = Math.floor(Math.random() * workingPool.length);
    const winner = workingPool[winnerIndex];

    const runStep = (step: number) => {
      if (step < totalSteps) {
        const preview =
          fullCandidatePool[
            Math.floor(Math.random() * fullCandidatePool.length)
          ];
        setRollingCandidate(preview);
        playFlip();
        const delay = 55 + step * 16;
        pickerTimeoutRef.current = setTimeout(() => runStep(step + 1), delay);
      } else {
        setRollingCandidate(null);
        setCurrentPickedStudent(winner);
        setIsRollingPicker(false);
        playSuccess();
        if (avoidRepeatInLesson) {
          setPickedHistory((prev) =>
            resetTriggered ? [winner] : [...prev, winner]
          );
        }
      }
    };

    runStep(0);
  };

  // SVG Çizim Katmanı Pointer Olayları
  const eraseAtPoint = useCallback((pt: Point2D) => {
    setElements((prev) => {
      const filtered = prev.filter((el) => !hitTestElement(el, pt, 22));
      if (filtered.length !== prev.length) {
        playFlip();
      }
      return filtered;
    });
  }, []);

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === "navigate") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDrawingRef.current = true;

    const pt: Point2D = { x: e.clientX, y: e.clientY };

    if (activeTool === "eraser") {
      eraseAtPoint(pt);
      return;
    }

    const isHighlighter = activeTool === "highlighter";
    const strokeWidth = isHighlighter
      ? 26
      : activeTool === "arrow"
      ? 4.5
      : PEN_WIDTH_PX[penWidth];

    const colorHex = isHighlighter
      ? selectedColorObj.highlighterHex
      : selectedColorObj.hex;

    const newEl: DrawingElement = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind:
        activeTool === "arrow"
          ? "arrow"
          : isHighlighter
          ? "highlighter"
          : "pen",
      colorId: activeColorId,
      colorHex,
      strokeWidth,
      points: activeTool === "arrow" ? [pt, pt] : [pt],
    };

    setDraftElement(newEl);
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPointerDrawingRef.current || activeTool === "navigate") return;
    e.preventDefault();

    const pt: Point2D = { x: e.clientX, y: e.clientY };

    if (activeTool === "eraser") {
      eraseAtPoint(pt);
      return;
    }

    setDraftElement((prev) => {
      if (!prev) return null;
      if (prev.kind === "arrow") {
        return {
          ...prev,
          points: [prev.points[0], pt],
        };
      }
      const last = prev.points[prev.points.length - 1];
      const distSq = (pt.x - last.x) ** 2 + (pt.y - last.y) ** 2;
      if (distSq < 4) return prev;
      return {
        ...prev,
        points: [...prev.points, pt],
      };
    });
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPointerDrawingRef.current) return;
    isPointerDrawingRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (draftElement) {
      const shouldKeep =
        draftElement.kind !== "arrow" ||
        (draftElement.points.length >= 2 &&
          (draftElement.points[1].x - draftElement.points[0].x) ** 2 +
            (draftElement.points[1].y - draftElement.points[0].y) ** 2 >
            100);
      if (shouldKeep) {
        setElements((prev) => [...prev, draftElement]);
      }
      setDraftElement(null);
    }
  };

  const handleUndo = () => {
    if (elements.length === 0) return;
    playClick();
    setElements((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    if (elements.length === 0) return;
    playClick();
    setElements([]);
    setDraftElement(null);
  };

  // 🎭 Tahta Perdesi Tutamaç Sürükleme
  const handleCurtainPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingCurtainRef.current = true;
  };

  const handleCurtainPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCurtainRef.current) return;
    e.preventDefault();
    if (curtainAxis === "vertical") {
      const nextRatio = e.clientY / Math.max(1, window.innerHeight);
      setCurtainRatio(nextRatio);
    } else {
      const nextRatio = e.clientX / Math.max(1, window.innerWidth);
      setCurtainRatio(nextRatio);
    }
  };

  const handleCurtainPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCurtainRef.current) return;
    isDraggingCurtainRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const isDrawingInteractive = activeTool !== "navigate";
  const allRenderedElements = draftElement
    ? [...elements, draftElement]
    : elements;

  const dockContainerClasses =
    dockZone === "right"
      ? "fixed right-2 sm:right-3 top-1/2 -translate-y-1/2 z-[58] max-h-[90vh] overflow-y-auto"
      : dockZone === "left"
      ? "fixed left-2 sm:left-3 top-1/2 -translate-y-1/2 z-[58] max-h-[90vh] overflow-y-auto"
      : "fixed bottom-16 md:bottom-3 left-1/2 -translate-x-1/2 z-[58] max-w-[calc(100vw-1rem)]";

  const isVerticalDock = dockZone === "right" || dockZone === "left";

  return (
    <div className="print:hidden">
      {/* =================================================================== */}
      {/* 1. DOM DOSTU BAĞIMSIZ SVG ÇİZİM VE İ'RAB FOSFORLU VURGULAMA KATMANI */}
      {/* =================================================================== */}
      <svg
        aria-label="Akıllı Tahta Çizim ve İ'rab Boyama Katmanı"
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerCancel={handleSvgPointerUp}
        className={`fixed inset-0 w-screen h-screen z-[54] select-none ${
          isDrawingInteractive
            ? activeTool === "eraser"
              ? "pointer-events-auto touch-none cursor-cell"
              : "pointer-events-auto touch-none cursor-crosshair"
            : "pointer-events-none"
        }`}
      >
        <defs>
          {IRAB_SEMANTIC_PALETTE.map((col) => (
            <marker
              key={`arrow-marker-${col.id}`}
              id={`sb-arrow-${col.id}`}
              viewBox="0 0 12 12"
              refX="9.5"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 1 1.5 L 10.5 6 L 1 10.5 z" fill={col.hex} />
            </marker>
          ))}
        </defs>

        {allRenderedElements.map((el) => {
          if (el.kind === "arrow" && el.points.length >= 2) {
            const p0 = el.points[0];
            const p1 = el.points[1];
            return (
              <line
                key={el.id}
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke={el.colorHex}
                strokeWidth={el.strokeWidth}
                strokeLinecap="round"
                markerEnd={`url(#sb-arrow-${el.colorId})`}
              />
            );
          }

          const pathData = buildSmoothSvgPath(el.points);
          if (!pathData) return null;

          if (el.kind === "highlighter") {
            return (
              <path
                key={el.id}
                d={pathData}
                fill="none"
                stroke={el.colorHex}
                strokeWidth={el.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isDark ? 0.34 : 0.42}
                style={{
                  mixBlendMode: isDark ? "screen" : "multiply",
                }}
              />
            );
          }

          return (
            <path
              key={el.id}
              d={pathData}
              fill="none"
              stroke={el.colorHex}
              strokeWidth={el.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      {/* =================================================================== */}
      {/* 2. 🎭 SÜRÜKLENEBİLİR TAHTA PERDESİ (SCREEN SHADE / CURTAIN)         */}
      {/* =================================================================== */}
      {curtainOpen && (
        <div
          style={
            curtainAxis === "vertical"
              ? {
                  top: `${Math.round(curtainRatio * 100)}%`,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }
              : {
                  left: `${Math.round(curtainRatio * 100)}%`,
                  top: 0,
                  bottom: 0,
                  right: 0,
                }
          }
          className="fixed z-[55] bg-gradient-to-br from-[#064E3B] via-[#0F172A] to-[#1E293B] text-white shadow-2xl border-emerald-400/70 flex flex-col select-none"
        >
          {/* Sürükleme Tutamacı */}
          <div
            onPointerDown={handleCurtainPointerDown}
            onPointerMove={handleCurtainPointerMove}
            onPointerUp={handleCurtainPointerUp}
            onPointerCancel={handleCurtainPointerUp}
            className={`touch-none bg-emerald-800/95 hover:bg-emerald-700 border-emerald-300/60 flex items-center justify-between gap-2 px-3 sm:px-5 py-2 shadow-md ${
              curtainAxis === "vertical"
                ? "w-full min-h-[52px] border-t-4 border-b border-b-white/15 cursor-ns-resize flex-row"
                : "h-full min-w-[56px] border-l-4 border-r border-r-white/15 cursor-ew-resize flex-col py-4"
            }`}
          >
            <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm text-emerald-50">
              <GripHorizontal size={18} className="text-amber-300 shrink-0" />
              {curtainAxis === "vertical" ? (
                <span>
                  🎭 Tahta Perdesi — Açmak için tutamaçtan aşağı kaydırın
                </span>
              ) : (
                <span className="writing-mode-vertical text-center text-xs">
                  🎭 Perde
                </span>
              )}
            </div>

            <div
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-2 ${
                curtainAxis === "horizontal" ? "flex-col" : "flex-row"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setCurtainAxis(
                    curtainAxis === "vertical" ? "horizontal" : "vertical"
                  );
                  setCurtainRatio(0.5);
                }}
                title="Perde Yönünü Değiştir (Alt-Üst / Sağ-Sol)"
                className="min-h-[48px] px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {curtainAxis === "vertical" ? (
                  <>
                    <ArrowLeftRight size={15} />
                    <span className="hidden sm:inline">Sağ-Sol Perde</span>
                  </>
                ) : (
                  <ArrowUpDown size={15} />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setCurtainOpen(false);
                }}
                className="min-h-[48px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-300/60 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <X size={15} />
                {curtainAxis === "vertical" && <span>Perdeyi Kaldır</span>}
              </button>
            </div>
          </div>

          {/* Perde Gövdesi Bilgi Deseni */}
          {curtainAxis === "vertical" && (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center pointer-events-none opacity-80">
              <Blinds size={34} className="text-emerald-300 mb-2" />
              <p className="text-sm sm:text-base font-extrabold text-emerald-100">
                Alt Bölüm Öğretmen Perdesi İle Gizlendi
              </p>
              <p className="text-xs text-emerald-200/80 mt-1 max-w-md">
                Cevapları veya sıradaki cümleleri adım adım göstermek için üstteki zümrüt tutamaçtan aşağı doğru sürükleyin.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. ⏱️ YÜZEN DERS ZAMANLAYICISI (GERİ SAYIM & KRONOMETRE)            */}
      {/* =================================================================== */}
      {timerOpen && (
        <div
          className={`fixed top-16 right-3 sm:right-5 z-[59] w-[300px] sm:w-[330px] rounded-3xl border-2 border-b-4 shadow-2xl p-3.5 space-y-3 transition-all ${
            timerFinishedFlash
              ? "bg-amber-50 dark:bg-amber-950 border-amber-500 ring-4 ring-amber-400/50"
              : "bg-[#FDFBF7] dark:bg-[var(--surface)] border-[#087F5B]"
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#087F5B] text-white flex items-center justify-center">
                <Timer size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
                  ⏱️ Ders Zamanlayıcısı
                </h3>
                <p className="text-[10px] font-bold text-[var(--muted)]">
                  {timerMode === "countdown"
                    ? "Geri Sayım Sayacı"
                    : "İleri Kronometre"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playClick();
                setTimerRunning(false);
                setTimerOpen(false);
              }}
              aria-label="Zamanlayıcıyı Kapat"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Büyük Dijital Saat Göstergesi */}
          <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] py-3 px-4 text-center">
            <div
              className={`text-4xl sm:text-5xl font-black tabular-nums tracking-wider ${
                timerFinishedFlash
                  ? "text-amber-700 dark:text-amber-300 animate-pulse"
                  : timerMode === "countdown" && timerSeconds <= 10
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-[#065F46] dark:text-emerald-300"
              }`}
            >
              {formatTimerClock(timerSeconds)}
            </div>
            {timerFinishedFlash && (
              <p className="text-xs font-extrabold text-amber-800 dark:text-amber-200 mt-1">
                🔔 Süre Tamamlandı!
              </p>
            )}
          </div>

          {/* Hazır Süre Butonları */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { sec: 30, label: "30 sn" },
              { sec: 60, label: "1 dk" },
              { sec: 120, label: "2 dk" },
              { sec: 180, label: "3 dk" },
              { sec: 300, label: "5 dk" },
            ].map((p) => {
              const active =
                timerMode === "countdown" && presetSeconds === p.sec;
              return (
                <button
                  key={p.sec}
                  type="button"
                  onClick={() => handleSelectCountdownPreset(p.sec)}
                  className={`min-h-[48px] rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                    active
                      ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                      : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleSwitchStopwatch}
              className={`min-h-[48px] rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                timerMode === "stopwatch"
                  ? "bg-[#6741D9] border-[#5230B5] text-white shadow-xs"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]"
              }`}
            >
              Kronometre
            </button>
          </div>

          {/* Başlat / Duraklat / Sıfırla */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                playClick();
                setTimerFinishedFlash(false);
                if (timerMode === "countdown" && timerSeconds === 0) {
                  setTimerSeconds(presetSeconds);
                }
                setTimerRunning((r) => !r);
              }}
              className={`min-h-[48px] rounded-xl font-extrabold text-xs text-white border-b-3 flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                timerRunning
                  ? "bg-amber-600 hover:bg-amber-700 border-amber-800"
                  : "bg-[#087F5B] hover:bg-[#065F46] border-[#065F46]"
              }`}
            >
              {timerRunning ? (
                <>
                  <Pause size={15} />
                  <span>Duraklat</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>Başlat</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetTimer}
              className="min-h-[48px] rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] flex items-center justify-center gap-1.5 cursor-pointer hover:border-[#087F5B]"
            >
              <RotateCcw size={15} />
              <span>Sıfırla</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. 🎡 SINIF KURA ÇARKI (RANDOM STUDENT PICKER) MODALI               */}
      {/* =================================================================== */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-[62] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="bg-[#F7EFE1] dark:bg-[var(--background)] px-4 sm:px-5 py-3 border-b-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#6741D9] text-white flex items-center justify-center shrink-0">
                  <Dices size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                    🎡 Sınıf Kura Çarkı (Öğrenci Seçici)
                  </h3>
                  <p className="text-[11px] font-semibold text-[var(--muted)]">
                    İsimler yalnızca bu cihazda (tarayıcıda) tutulur; sunucuya gönderilmez.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setPickerOpen(false);
                }}
                aria-label="Kura Penceresini Kapat"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Kaynak Mod Seçici */}
              <div className="grid grid-cols-2 gap-2 bg-[#F7EFE1] dark:bg-[var(--background)] p-1.5 rounded-2xl border border-[#E6D7BE] dark:border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setPickerMode("numbers");
                    setPickedHistory([]);
                    setCurrentPickedStudent(null);
                  }}
                  className={`min-h-[48px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    pickerMode === "numbers"
                      ? "bg-[#087F5B] text-white shadow-xs"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span>🔢 Numara Aralığı (1–35)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setPickerMode("names");
                    setPickedHistory([]);
                    setCurrentPickedStudent(null);
                  }}
                  className={`min-h-[48px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    pickerMode === "names"
                      ? "bg-[#6741D9] text-white shadow-xs"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Users size={15} />
                  <span>📋 Sınıf Listesi Yapıştır</span>
                </button>
              </div>

              {/* Numara Aralığı veya İsim Listesi Girişi */}
              {pickerMode === "numbers" ? (
                <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-extrabold text-[var(--foreground)]">
                      Başlangıç No:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={rangeStart}
                      onChange={(e) =>
                        updateNumberRange(Number(e.target.value), rangeEnd)
                      }
                      className="w-20 min-h-[48px] px-3 rounded-xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] text-center font-black text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-extrabold text-[var(--foreground)]">
                      Bitiş No:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={rangeEnd}
                      onChange={(e) =>
                        updateNumberRange(rangeStart, Number(e.target.value))
                      }
                      className="w-20 min-h-[48px] px-3 rounded-xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] text-center font-black text-sm"
                    />
                  </div>
                  <span className="text-xs font-bold text-[#065F46] dark:text-emerald-400">
                    Toplam {fullCandidatePool.length} Öğrenci
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[var(--foreground)]">
                      Her satıra bir öğrenci adı veya rumuz yazın ({fullCandidatePool.length} kişi):
                    </span>
                    {rosterText.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearRoster}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-xs font-extrabold cursor-pointer"
                      >
                        🧹 Listeyi Sil
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={rosterText}
                    onChange={(e) => handleRosterTextChange(e.target.value)}
                    placeholder={"Ahmet Yılmaz\nZeynep Kaya\nMustafa Demir..."}
                    className="w-full rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-white dark:bg-[var(--background)] p-3 text-xs sm:text-sm font-semibold text-[var(--foreground)] focus:outline-none focus:border-[#6741D9]"
                  />
                </div>
              )}

              {/* Seçilen Büyük Öğrenci Kartı */}
              <div className="rounded-3xl bg-gradient-to-br from-[#087F5B] via-emerald-700 to-teal-800 text-white p-5 text-center shadow-lg border-2 border-emerald-400/50 min-h-[128px] flex flex-col items-center justify-center">
                {isRollingPicker ? (
                  <>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-200 mb-1">
                      🎡 Kura Çekiliyor...
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-amber-300 animate-pulse">
                      {rollingCandidate || "..."}
                    </div>
                  </>
                ) : currentPickedStudent ? (
                  <>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/15 text-xs font-extrabold text-amber-200 mb-1.5">
                      <Sparkles size={13} />
                      <span>Söz Hakkı Kazanan Öğrenci</span>
                    </span>
                    <div className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                      {currentPickedStudent}
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-bold text-emerald-100">
                    Söz hakkı vermek için aşağıdaki &ldquo;🎲 Öğrenci Seç&rdquo; butonuna dokunun.
                  </p>
                )}
              </div>

              {/* Tekrarsız Seçim Kutusu ve Tur Sıfırlama */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] px-3.5 py-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={avoidRepeatInLesson}
                    onChange={(e) => {
                      playClick();
                      setAvoidRepeatInLesson(e.target.checked);
                    }}
                    className="w-5 h-5 accent-[#087F5B] rounded cursor-pointer"
                  />
                  <span>Seçileni Bu Derste Tekrar Seçme</span>
                </label>

                {avoidRepeatInLesson && (
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="text-[#065F46] dark:text-emerald-400">
                      Kalan: {remainingCandidates.length} / {fullCandidatePool.length}
                    </span>
                    {pickedHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setPickedHistory([]);
                          setCurrentPickedStudent(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] text-[11px] font-extrabold text-[#6741D9] cursor-pointer"
                      >
                        🔄 Turu Sıfırla
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 🎲 Öğrenci Seç Ana Aksiyon Butonu */}
              <button
                type="button"
                disabled={isRollingPicker || fullCandidatePool.length === 0}
                onClick={handlePickRandomStudent}
                className="w-full min-h-[52px] rounded-2xl bg-[#6741D9] hover:bg-[#5230B5] disabled:opacity-50 text-white font-black text-sm sm:text-base border-b-4 border-[#422399] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Dices size={20} />
                <span>🎲 Öğrenci Seç</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. AKILLI TAHTA ERİŞİM BÖLGESİ YÜZEN KONSOLU (ALT / SAĞ / SOL)      */}
      {/* =================================================================== */}
      <div className={dockContainerClasses}>
        {isCollapsed ? (
          <div className="flex items-center gap-1.5 rounded-2xl bg-[#0F172A]/95 text-white border-2 border-emerald-400/70 p-1.5 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                playClick();
                setCollapsed(false);
              }}
              className="min-h-[48px] px-3.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer"
            >
              <PenTool size={16} />
              <span>🖍️ Tahta Araçlarını Aç</span>
              <ChevronUp size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                playClick();
                closeToolbar();
              }}
              aria-label="Tahta Konsolunu Kapat"
              className="min-w-[48px] min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        ) : (
          <div
            className={`rounded-3xl bg-[#FDFBF7]/98 dark:bg-[#0F172A]/98 backdrop-blur-md border-2 border-[#087F5B] border-b-4 shadow-2xl p-2 sm:p-2.5 flex ${
              isVerticalDock
                ? "flex-col items-stretch gap-2 w-[230px]"
                : "flex-col gap-2"
            }`}
          >
            {/* Üst Araç Butonları Satırı */}
            <div
              className={`flex items-center gap-1.5 ${
                isVerticalDock ? "flex-col items-stretch" : "flex-wrap justify-center"
              }`}
            >
              {(
                [
                  {
                    id: "navigate" as SmartboardTool,
                    label: "Gezinme",
                    title:
                      "👆 Etkileşim / Gezinme Modu (Çizimler kalır, alttaki kelimelere ve seslere tıklanabilir)",
                    icon: MousePointer2,
                  },
                  {
                    id: "pen" as SmartboardTool,
                    label: "Kalem",
                    title: "🖊️ İnce Tahta Kalemi",
                    icon: PenTool,
                  },
                  {
                    id: "highlighter" as SmartboardTool,
                    label: "Fosforlu İ'rab",
                    title:
                      "🖍️ Fosforlu İ'rab Vurgulayıcı (Harekeleri kapatmaz)",
                    icon: Highlighter,
                  },
                  {
                    id: "arrow" as SmartboardTool,
                    label: "Bağlantı Oku",
                    title:
                      "↗️ Bağlantı Oku & Çizgi Aracı (Zamir mercii ve sıfat-mevsûf bağlantıları için)",
                    icon: MoveUpRight,
                  },
                  {
                    id: "eraser" as SmartboardTool,
                    label: "Silgi",
                    title: "🧽 Silgi (Dokunduğunuz çizgiyi veya oku siler)",
                    icon: Eraser,
                  },
                ] as const
              ).map((tool) => {
                const Icon = tool.icon;
                const active = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    title={tool.title}
                    onClick={() => {
                      playClick();
                      setActiveTool(tool.id);
                    }}
                    className={`min-h-[48px] px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? tool.id === "navigate"
                          ? "bg-[#087F5B] border-[#065F46] text-white shadow-sm"
                          : "bg-[#6741D9] border-[#5230B5] text-white shadow-sm"
                        : "bg-white dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#087F5B]"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}

              {/* Geri Al & Temizle */}
              <button
                type="button"
                disabled={elements.length === 0}
                onClick={handleUndo}
                title="↩️ Son Çizimi Geri Al (Undo)"
                className="min-h-[48px] min-w-[48px] px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 disabled:opacity-40 text-xs font-extrabold text-[var(--foreground)] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Undo2 size={16} />
                <span className="hidden xl:inline">Geri Al</span>
              </button>

              <button
                type="button"
                disabled={elements.length === 0}
                onClick={handleClearAll}
                title="🗑️ Tüm Çizimleri Temizle"
                className="min-h-[48px] min-w-[48px] px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 disabled:opacity-40 text-xs font-extrabold text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 size={16} />
                <span className="hidden xl:inline">Temizle</span>
              </button>

              {/* Ayırıcı */}
              {!isVerticalDock && (
                <span
                  aria-hidden="true"
                  className="hidden sm:inline-block w-px h-7 bg-[#E6D7BE] dark:bg-slate-700 mx-0.5"
                />
              )}

              {/* 🎭 Tahta Perdesi, 🎡 Kura Çarkı, ⏱️ Zamanlayıcı */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  toggleCurtain();
                }}
                title="🎭 Sürüklenebilir Tahta Perdesi (Ekranın altını veya yanını kapatır)"
                className={`min-h-[48px] px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  curtainOpen
                    ? "bg-amber-500 border-amber-700 text-slate-950 shadow-sm"
                    : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-amber-500"
                }`}
              >
                <Blinds size={16} className="shrink-0" />
                <span>Perde</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  togglePicker();
                }}
                title="🎡 Sınıf Kura Çarkı (Rastgele Öğrenci Seçici)"
                className={`min-h-[48px] px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  pickerOpen
                    ? "bg-[#6741D9] border-[#5230B5] text-white shadow-sm"
                    : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#6741D9]"
                }`}
              >
                <Dices size={16} className="shrink-0" />
                <span>Kura</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  toggleTimer();
                }}
                title="⏱️ Ders Zamanlayıcısı ve Kronometre"
                className={`min-h-[48px] px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  timerOpen
                    ? "bg-[#087F5B] border-[#065F46] text-white shadow-sm"
                    : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#087F5B]"
                }`}
              >
                <Timer size={16} className="shrink-0" />
                <span>
                  {timerRunning ? formatTimerClock(timerSeconds) : "Sayaç"}
                </span>
              </button>
            </div>

            {/* Alt Satır: 5 Semantik İ'rab Renk Paleti + Kalem Kalınlığı + Tahta Konumu + Küçült/Kapat */}
            <div
              className={`flex items-center justify-between gap-2 pt-1.5 border-t border-dashed border-[#E2D3B8] dark:border-slate-700 ${
                isVerticalDock ? "flex-col items-stretch" : "flex-wrap"
              }`}
            >
              {/* Semantik İ'rab Renk Uçları */}
              <div
                className={`flex items-center gap-1 ${
                  isVerticalDock ? "flex-col items-stretch" : "flex-wrap"
                }`}
              >
                {IRAB_SEMANTIC_PALETTE.map((col) => {
                  const isSelected = activeColorId === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      title={`${col.badgeDot} ${col.pedagogicalRole}`}
                      onClick={() => {
                        playClick();
                        setActiveColorId(col.id);
                        if (
                          activeTool === "navigate" ||
                          activeTool === "eraser"
                        ) {
                          setActiveTool("highlighter");
                        }
                      }}
                      className={`min-h-[48px] px-2.5 rounded-xl border-2 text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-emerald-500 shadow-sm"
                          : "bg-white dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: col.hex }}
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15"
                      />
                      <span>{col.pedagogicalRole}</span>
                    </button>
                  );
                })}
              </div>

              {/* Kalem Kalınlığı (Kalem seçiliyse) + Erişim Bölgesi Konumu + Küçült/Kapat */}
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                {activeTool === "pen" && (
                  <div className="flex items-center gap-1 bg-[#F7EFE1] dark:bg-slate-800 p-1 rounded-xl border border-[#E6D7BE] dark:border-slate-700">
                    {(
                      [
                        { id: "thin" as PenWidthPreset, label: "İnce" },
                        { id: "medium" as PenWidthPreset, label: "Orta" },
                        { id: "thick" as PenWidthPreset, label: "Kalın" },
                      ] as const
                    ).map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          playClick();
                          setPenWidth(w.id);
                        }}
                        className={`min-h-[40px] px-2.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                          penWidth === w.id
                            ? "bg-[#6741D9] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Akıllı Tahta Erişim Bölgesi Seçici (Sol / Alt / Sağ) */}
                <div className="hidden md:flex items-center gap-0.5 bg-[#F7EFE1] dark:bg-slate-800 p-1 rounded-xl border border-[#E6D7BE] dark:border-slate-700">
                  {(
                    [
                      {
                        id: "left" as DockReachZone,
                        icon: PanelLeft,
                        title: "Konsolu Sol Kenara Yasla",
                      },
                      {
                        id: "bottom" as DockReachZone,
                        icon: PanelBottom,
                        title: "Konsolu Alt Ortaya Yasla",
                      },
                      {
                        id: "right" as DockReachZone,
                        icon: PanelRight,
                        title: "Konsolu Sağ Kenara Yasla",
                      },
                    ] as const
                  ).map((z) => {
                    const ZIcon = z.icon;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        title={z.title}
                        onClick={() => {
                          playClick();
                          setDockZone(z.id);
                        }}
                        className={`min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center cursor-pointer ${
                          dockZone === z.id
                            ? "bg-[#087F5B] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <ZIcon size={15} />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  title="Konsolu Küçült (Çizimler ekranda kalır)"
                  onClick={() => {
                    playClick();
                    setActiveTool("navigate");
                    setCollapsed(true);
                  }}
                  className="min-h-[48px] min-w-[48px] px-2.5 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-xs font-extrabold text-[var(--foreground)] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ChevronDown size={16} />
                </button>

                <button
                  type="button"
                  title="Tahta Araçlarını Kapat"
                  onClick={() => {
                    playClick();
                    closeToolbar();
                  }}
                  className="min-h-[48px] px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X size={16} />
                  <span>Kapat</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
