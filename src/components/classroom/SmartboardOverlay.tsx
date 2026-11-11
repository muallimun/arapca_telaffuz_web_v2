"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MousePointer2,
  PenTool,
  Highlighter,
  MoveUpRight,
  Minus,
  Circle,
  Square,
  RectangleHorizontal,
  Triangle,
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
  Palette,
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

export const BOARD_COLOR_SWATCHES: { hex: string; label: string }[] = [
  { hex: "#EF4444", label: "Kırmızı" },
  { hex: "#059669", label: "Zümrüt Yeşil" },
  { hex: "#2563EB", label: "Mavi" },
  { hex: "#F97316", label: "Turuncu" },
  { hex: "#EAB308", label: "Fosforlu Sarı" },
  { hex: "#7C3AED", label: "Mor" },
  { hex: "#EC4899", label: "Pembe" },
  { hex: "#06B6D4", label: "Turkuaz" },
  { hex: "#0F172A", label: "Siyah" },
  { hex: "#FFFFFF", label: "Beyaz" },
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

type DrawingElementKind =
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "circle"
  | "square"
  | "rect"
  | "triangle";

interface DrawingElement {
  id: string;
  kind: DrawingElementKind;
  colorId: IrabSemanticColorId;
  colorHex: string;
  strokeWidth: number;
  points: Point2D[];
}

const ROSTER_STORAGE_KEY = "muallimun_classroom_roster_v1";
const ROSTER_RANGE_KEY = "muallimun_classroom_range_v1";

function isTwoPointGeometricKind(kind: DrawingElementKind): boolean {
  return (
    kind === "line" ||
    kind === "arrow" ||
    kind === "circle" ||
    kind === "square" ||
    kind === "rect" ||
    kind === "triangle"
  );
}

function computeSquareBounds(p0: Point2D, p1: Point2D) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const x = dx >= 0 ? p0.x : p0.x - side;
  const y = dy >= 0 ? p0.y : p0.y - side;
  return { x, y, w: side, h: side };
}

function computeRectBounds(p0: Point2D, p1: Point2D) {
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);
  return { x, y, w, h };
}

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

function hitTestSegments(
  pt: Point2D,
  vertices: Point2D[],
  closed: boolean,
  thresholdSq: number
): boolean {
  for (let i = 0; i < vertices.length - 1; i++) {
    if (
      distanceToSegmentSquared(pt, vertices[i], vertices[i + 1]) <= thresholdSq
    ) {
      return true;
    }
  }
  if (
    closed &&
    vertices.length >= 3 &&
    distanceToSegmentSquared(
      pt,
      vertices[vertices.length - 1],
      vertices[0]
    ) <= thresholdSq
  ) {
    return true;
  }
  return false;
}

function hitTestElement(el: DrawingElement, pt: Point2D, radius = 22): boolean {
  const thresholdSq = (radius + el.strokeWidth * 0.5) ** 2;
  if (el.points.length === 0) return false;
  if (el.points.length === 1) {
    const dSq = (pt.x - el.points[0].x) ** 2 + (pt.y - el.points[0].y) ** 2;
    return dSq <= thresholdSq;
  }

  const p0 = el.points[0];
  const p1 = el.points[1];

  if (el.kind === "rect" || el.kind === "square") {
    const b =
      el.kind === "square"
        ? computeSquareBounds(p0, p1)
        : computeRectBounds(p0, p1);
    return hitTestSegments(
      pt,
      [
        { x: b.x, y: b.y },
        { x: b.x + b.w, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
      ],
      true,
      thresholdSq
    );
  }

  if (el.kind === "triangle") {
    const b = computeRectBounds(p0, p1);
    return hitTestSegments(
      pt,
      [
        { x: b.x + b.w / 2, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
      ],
      true,
      thresholdSq
    );
  }

  if (el.kind === "circle") {
    const b = computeRectBounds(p0, p1);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = Math.max(2, b.w / 2);
    const ry = Math.max(2, b.h / 2);
    const samplePts: Point2D[] = [];
    const steps = 24;
    for (let s = 0; s < steps; s++) {
      const ang = (s / steps) * Math.PI * 2;
      samplePts.push({
        x: cx + rx * Math.cos(ang),
        y: cy + ry * Math.sin(ang),
      });
    }
    return hitTestSegments(pt, samplePts, true, thresholdSq);
  }

  return hitTestSegments(pt, el.points, false, thresholdSq);
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
    activeColorHex,
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
    setActiveColorHex,
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

  // Serbest Sürükle-Bırak (Hem Küçültülmüş Hap Hem Açık Konsol İçin)
  const [floatingPos, setFloatingPos] = useState<Point2D | null>(null);
  const dockBoxRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originLeft: number;
    originTop: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    originLeft: 0,
    originTop: 0,
    moved: false,
  });
  const suppressNextToggleClickRef = useRef(false);

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

  // Küçültülmüş hap açıldığında veya ekran boyutu değiştiğinde kutuyu ekran sınırlarına kilitle
  useEffect(() => {
    if (!isOpen || !floatingPos) return;
    const clampIntoScreen = () => {
      const box = dockBoxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const maxX = Math.max(8, window.innerWidth - rect.width - 8);
      const maxY = Math.max(8, window.innerHeight - rect.height - 8);
      const clampedX = Math.min(maxX, Math.max(8, floatingPos.x));
      const clampedY = Math.min(maxY, Math.max(8, floatingPos.y));
      if (clampedX !== floatingPos.x || clampedY !== floatingPos.y) {
        setFloatingPos({ x: Math.round(clampedX), y: Math.round(clampedY) });
      }
    };
    const raf = requestAnimationFrame(clampIntoScreen);
    window.addEventListener("resize", clampIntoScreen);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", clampIntoScreen);
    };
  }, [isOpen, isCollapsed, floatingPos]);

  const handleDockDragPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const box = dockBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };
    suppressNextToggleClickRef.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleDockDragPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startClientX;
    const dy = e.clientY - st.startClientY;
    const dist = Math.hypot(dx, dy);
    if (!st.moved && dist <= 6) return;

    st.moved = true;
    suppressNextToggleClickRef.current = true;
    e.preventDefault();

    const box = dockBoxRef.current;
    const boxW = box ? box.offsetWidth : 220;
    const boxH = box ? box.offsetHeight : 56;
    const maxX = Math.max(8, window.innerWidth - boxW - 8);
    const maxY = Math.max(8, window.innerHeight - boxH - 8);
    const nextX = Math.min(maxX, Math.max(8, st.originLeft + dx));
    const nextY = Math.min(maxY, Math.max(8, st.originTop + dy));
    setFloatingPos({ x: Math.round(nextX), y: Math.round(nextY) });
  };

  const handleDockDragPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    st.active = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

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

  // ⏱️ Ders Zamanlayıcısı Tiki
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

    const kind: DrawingElementKind =
      activeTool === "highlighter"
        ? "highlighter"
        : activeTool === "line"
        ? "line"
        : activeTool === "arrow"
        ? "arrow"
        : activeTool === "circle"
        ? "circle"
        : activeTool === "square"
        ? "square"
        : activeTool === "rect"
        ? "rect"
        : activeTool === "triangle"
        ? "triangle"
        : "pen";

    const strokeWidth =
      kind === "highlighter"
        ? 26
        : isTwoPointGeometricKind(kind)
        ? Math.max(3.5, PEN_WIDTH_PX[penWidth])
        : PEN_WIDTH_PX[penWidth];

    const newEl: DrawingElement = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      colorId: activeColorId,
      colorHex: activeColorHex,
      strokeWidth,
      points: isTwoPointGeometricKind(kind) ? [pt, pt] : [pt],
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
      if (isTwoPointGeometricKind(prev.kind)) {
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
        !isTwoPointGeometricKind(draftElement.kind) ||
        (draftElement.points.length >= 2 &&
          (draftElement.points[1].x - draftElement.points[0].x) ** 2 +
            (draftElement.points[1].y - draftElement.points[0].y) ** 2 >
            64);
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

  const isVerticalDock =
    !floatingPos && (dockZone === "right" || dockZone === "left");

  const dockContainerClasses = floatingPos
    ? "fixed z-[58] max-w-[calc(100vw-1rem)]"
    : dockZone === "right"
    ? "fixed right-2 sm:right-3 top-1/2 -translate-y-1/2 z-[58] max-w-[calc(100vw-1rem)]"
    : dockZone === "left"
    ? "fixed left-2 sm:left-3 top-1/2 -translate-y-1/2 z-[58] max-w-[calc(100vw-1rem)]"
    : "fixed bottom-16 md:bottom-3 left-1/2 -translate-x-1/2 z-[58] max-w-[calc(100vw-1rem)]";

  return (
    <div className="print:hidden">
      {/* =================================================================== */}
      {/* 1. DOM DOSTU BAĞIMSIZ SVG ÇİZİM VE GEOMETRİK ŞEKİL KATMANI          */}
      {/* =================================================================== */}
      <svg
        aria-label="Akıllı Tahta Çizim ve Şekil Katmanı"
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
          {allRenderedElements
            .filter((el) => el.kind === "arrow")
            .map((el) => (
              <marker
                key={`arrow-marker-${el.id}`}
                id={`sb-arrow-${el.id}`}
                viewBox="0 0 12 12"
                refX="9.5"
                refY="6"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto-start-reverse"
              >
                <path d="M 1 1.5 L 10.5 6 L 1 10.5 z" fill={el.colorHex} />
              </marker>
            ))}
        </defs>

        {allRenderedElements.map((el) => {
          if (el.points.length >= 2 && isTwoPointGeometricKind(el.kind)) {
            const p0 = el.points[0];
            const p1 = el.points[1];

            if (el.kind === "arrow") {
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
                  markerEnd={`url(#sb-arrow-${el.id})`}
                />
              );
            }

            if (el.kind === "line") {
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
                />
              );
            }

            if (el.kind === "rect" || el.kind === "square") {
              const b =
                el.kind === "square"
                  ? computeSquareBounds(p0, p1)
                  : computeRectBounds(p0, p1);
              return (
                <rect
                  key={el.id}
                  x={b.x}
                  y={b.y}
                  width={Math.max(1, b.w)}
                  height={Math.max(1, b.h)}
                  rx={4}
                  fill="none"
                  stroke={el.colorHex}
                  strokeWidth={el.strokeWidth}
                  strokeLinejoin="round"
                />
              );
            }

            if (el.kind === "circle") {
              const b = computeRectBounds(p0, p1);
              return (
                <ellipse
                  key={el.id}
                  cx={b.x + b.w / 2}
                  cy={b.y + b.h / 2}
                  rx={Math.max(1, b.w / 2)}
                  ry={Math.max(1, b.h / 2)}
                  fill="none"
                  stroke={el.colorHex}
                  strokeWidth={el.strokeWidth}
                />
              );
            }

            if (el.kind === "triangle") {
              const b = computeRectBounds(p0, p1);
              const ptsStr = `${(b.x + b.w / 2).toFixed(1)},${b.y.toFixed(1)} ${(b.x + b.w).toFixed(1)},${(b.y + b.h).toFixed(1)} ${b.x.toFixed(1)},${(b.y + b.h).toFixed(1)}`;
              return (
                <polygon
                  key={el.id}
                  points={ptsStr}
                  fill="none"
                  stroke={el.colorHex}
                  strokeWidth={el.strokeWidth}
                  strokeLinejoin="round"
                />
              );
            }
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
                opacity={isDark ? 0.36 : 0.42}
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
      {/* 5. SERBEST SÜRÜKLENEBİLİR & ŞEKİL ÇİZİMLİ TAHTA KONSOLU             */}
      {/* =================================================================== */}
      <div
        ref={dockBoxRef}
        style={
          floatingPos
            ? {
                left: `${floatingPos.x}px`,
                top: `${floatingPos.y}px`,
              }
            : undefined
        }
        className={dockContainerClasses}
      >
        {isCollapsed ? (
          <div
            onPointerDown={handleDockDragPointerDown}
            onPointerMove={handleDockDragPointerMove}
            onPointerUp={handleDockDragPointerUp}
            onPointerCancel={handleDockDragPointerUp}
            className="touch-none select-none cursor-grab active:cursor-grabbing flex items-center gap-1 rounded-2xl bg-[#0F172A]/95 text-white border-2 border-emerald-400/75 p-1 shadow-2xl"
          >
            <span
              title="Kutuyu istediğiniz yere sürükleyin"
              className="px-1.5 text-emerald-300 flex items-center justify-center shrink-0"
            >
              <GripHorizontal size={15} />
            </span>
            <button
              type="button"
              onClick={() => {
                if (suppressNextToggleClickRef.current) {
                  suppressNextToggleClickRef.current = false;
                  return;
                }
                playClick();
                setCollapsed(false);
              }}
              className="min-h-[44px] sm:min-h-[48px] px-3 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <PenTool size={15} />
              <span>🖍️ Tahta Araçlarını Aç</span>
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (suppressNextToggleClickRef.current) {
                  suppressNextToggleClickRef.current = false;
                  return;
                }
                playClick();
                closeToolbar();
              }}
              aria-label="Tahta Konsolunu Kapat"
              className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            className={`rounded-2xl sm:rounded-3xl bg-[#FDFBF7]/98 dark:bg-[#0F172A]/98 backdrop-blur-md border-2 border-[#087F5B] border-b-4 shadow-2xl p-2 sm:p-2.5 flex flex-col gap-1.5 ${
              isVerticalDock ? "w-[238px]" : "w-auto max-w-[calc(100vw-1rem)]"
            }`}
          >
            {/* Üst Sürükleme Başlığı + Konum Kısayolları + Küçült / Kapat */}
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-dashed border-[#E2D3B8] dark:border-slate-700">
              <div
                onPointerDown={handleDockDragPointerDown}
                onPointerMove={handleDockDragPointerMove}
                onPointerUp={handleDockDragPointerUp}
                onPointerCancel={handleDockDragPointerUp}
                title="Tahta konsolunu ekranın istediğiniz köşesine sürükleyin"
                className="touch-none select-none cursor-grab active:cursor-grabbing flex-1 flex items-center gap-1.5 py-1 px-1.5 rounded-lg hover:bg-[#F7EFE1] dark:hover:bg-slate-800 text-[11px] font-extrabold text-[var(--foreground)]"
              >
                <GripHorizontal
                  size={15}
                  className="text-[#087F5B] dark:text-emerald-400 shrink-0"
                />
                <span className="truncate">🖍️ Tahta Konsolu (Sürükle)</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="hidden md:flex items-center gap-0.5 bg-[#F7EFE1] dark:bg-slate-800 p-0.5 rounded-lg border border-[#E6D7BE] dark:border-slate-700">
                  {(
                    [
                      {
                        id: "left" as DockReachZone,
                        icon: PanelLeft,
                        title: "Sol Kenara Yasla",
                      },
                      {
                        id: "bottom" as DockReachZone,
                        icon: PanelBottom,
                        title: "Alt Ortaya Yasla",
                      },
                      {
                        id: "right" as DockReachZone,
                        icon: PanelRight,
                        title: "Sağ Kenara Yasla",
                      },
                    ] as const
                  ).map((z) => {
                    const ZIcon = z.icon;
                    const isPinnedHere = !floatingPos && dockZone === z.id;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        title={z.title}
                        onClick={() => {
                          playClick();
                          setFloatingPos(null);
                          setDockZone(z.id);
                        }}
                        className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer ${
                          isPinnedHere
                            ? "bg-[#087F5B] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <ZIcon size={13} />
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
                  className="h-7 px-2 rounded-lg bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-xs font-extrabold text-[var(--foreground)] flex items-center justify-center gap-0.5 cursor-pointer"
                >
                  <ChevronDown size={14} />
                  <span className="hidden sm:inline text-[11px]">Küçült</span>
                </button>

                <button
                  type="button"
                  title="Tahta Araçlarını Kapat"
                  onClick={() => {
                    playClick();
                    closeToolbar();
                  }}
                  className="h-7 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold flex items-center justify-center gap-0.5 cursor-pointer"
                >
                  <X size={13} />
                  <span className="hidden sm:inline">Kapat</span>
                </button>
              </div>
            </div>

            {/* 1. Satır: Çizim, Fosforlu ve Geometrik Şekil Araçları */}
            <div
              className={`grid gap-1 ${
                isVerticalDock
                  ? "grid-cols-2"
                  : "grid-cols-5 sm:flex sm:flex-wrap sm:items-center"
              }`}
            >
              {(
                [
                  {
                    id: "navigate" as SmartboardTool,
                    label: "Gezin",
                    title:
                      "👆 Etkileşim / Gezinme Modu (Alttaki kelimelere ve seslere tıklanabilir)",
                    icon: MousePointer2,
                  },
                  {
                    id: "pen" as SmartboardTool,
                    label: "Kalem",
                    title: "🖊️ Serbest Tahta Kalemi",
                    icon: PenTool,
                  },
                  {
                    id: "highlighter" as SmartboardTool,
                    label: "Fosforlu",
                    title:
                      "🖍️ Fosforlu Vurgulayıcı (Harekeleri kapatmaz)",
                    icon: Highlighter,
                  },
                  {
                    id: "line" as SmartboardTool,
                    label: "Çizgi",
                    title: "╱ Düz Çizgi (Alt çizme ve ayırma)",
                    icon: Minus,
                  },
                  {
                    id: "arrow" as SmartboardTool,
                    label: "Ok",
                    title: "↗ Bağlantı Oku (Zamir ve öge bağlantıları)",
                    icon: MoveUpRight,
                  },
                  {
                    id: "rect" as SmartboardTool,
                    label: "Dikdörtgen",
                    title: "▭ Dikdörtgen (İçi şeffaf kelime/terkip çerçevesi)",
                    icon: RectangleHorizontal,
                  },
                  {
                    id: "square" as SmartboardTool,
                    label: "Kare",
                    title: "⬜ Eşit Kenarlı Kare Kutu (İçi şeffaf)",
                    icon: Square,
                  },
                  {
                    id: "circle" as SmartboardTool,
                    label: "Daire",
                    title: "◯ Daire / Elips (İçi şeffaf vurgu halkası)",
                    icon: Circle,
                  },
                  {
                    id: "triangle" as SmartboardTool,
                    label: "Üçgen",
                    title: "△ Üçgen Şema Aracı (İçi şeffaf)",
                    icon: Triangle,
                  },
                  {
                    id: "eraser" as SmartboardTool,
                    label: "Silgi",
                    title: "🧽 Silgi (Dokunduğunuz çizgi veya şekli siler)",
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
                    className={`min-h-[38px] sm:min-h-[40px] px-2 sm:px-2.5 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? tool.id === "navigate"
                          ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                          : "bg-[#6741D9] border-[#5230B5] text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#087F5B]"
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="hidden sm:inline">{tool.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 2. Satır: 5x2 Görsel Renk Paleti + 🎨 Özel Renk + Kalınlık + Geri Al/Temizle + Perde/Kura/Sayaç */}
            <div
              className={`flex items-center justify-between gap-2 pt-1 border-t border-dashed border-[#E2D3B8] dark:border-slate-700 ${
                isVerticalDock ? "flex-col items-stretch" : "flex-wrap"
              }`}
            >
              {/* 5x2 Yuvarlak Görsel Renk Paleti + 🎨 Özel Renk Seçici */}
              <div className="flex items-center gap-2">
                <div className="grid grid-cols-5 gap-1.5 bg-[#F7EFE1]/80 dark:bg-slate-800/90 p-1.5 rounded-xl border border-[#E6D7BE] dark:border-slate-700">
                  {BOARD_COLOR_SWATCHES.map((sw) => {
                    const isSelected =
                      activeColorHex.toUpperCase() === sw.hex.toUpperCase();
                    return (
                      <button
                        key={sw.hex}
                        type="button"
                        title={`Renk: ${sw.label}`}
                        aria-label={`Renk: ${sw.label}`}
                        onClick={() => {
                          playClick();
                          setActiveColorHex(sw.hex);
                          if (
                            activeTool === "navigate" ||
                            activeTool === "eraser"
                          ) {
                            setActiveTool("pen");
                          }
                        }}
                        style={{ backgroundColor: sw.hex }}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          sw.hex === "#FFFFFF"
                            ? "border-2 border-slate-400"
                            : "border border-black/20"
                        } ${
                          isSelected
                            ? "ring-2 ring-offset-1 ring-[#6741D9] scale-110"
                            : "hover:scale-105"
                        }`}
                      />
                    );
                  })}
                </div>

                {/* 🎨 Özel Renk Seçici (<input type="color">) */}
                <label
                  title="🎨 Özel Renk Seçici"
                  className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 via-amber-400 to-indigo-600 p-0.5 flex items-center justify-center cursor-pointer shadow-2xs shrink-0"
                >
                  <span className="w-full h-full rounded-[10px] bg-white/90 dark:bg-slate-900/90 flex items-center justify-center text-[var(--foreground)]">
                    <Palette size={15} />
                  </span>
                  <input
                    type="color"
                    value={activeColorHex}
                    onChange={(e) => {
                      setActiveColorHex(e.target.value);
                      if (
                        activeTool === "navigate" ||
                        activeTool === "eraser"
                      ) {
                        setActiveTool("pen");
                      }
                    }}
                    aria-label="Özel Renk Seçici"
                    className="sr-only"
                  />
                </label>

                {/* Çizgi / Kalem Kalınlığı */}
                {activeTool !== "navigate" &&
                  activeTool !== "eraser" &&
                  activeTool !== "highlighter" && (
                    <div className="flex items-center gap-0.5 bg-[#F7EFE1] dark:bg-slate-800 p-1 rounded-xl border border-[#E6D7BE] dark:border-slate-700">
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
                          className={`h-7 px-2 rounded-lg text-[10px] font-extrabold cursor-pointer ${
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
              </div>

              {/* Geri Al / Temizle + Sınıf Araçları (Perde, Kura, Sayaç) */}
              <div
                className={`flex items-center gap-1 flex-wrap ${
                  isVerticalDock ? "justify-between" : "justify-end"
                }`}
              >
                <button
                  type="button"
                  disabled={elements.length === 0}
                  onClick={handleUndo}
                  title="↩️ Son Çizimi Geri Al"
                  className="h-9 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 disabled:opacity-40 text-xs font-extrabold text-[var(--foreground)] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Undo2 size={14} />
                  <span className="hidden xl:inline text-[11px]">Geri</span>
                </button>

                <button
                  type="button"
                  disabled={elements.length === 0}
                  onClick={handleClearAll}
                  title="🗑️ Tüm Çizimleri Temizle"
                  className="h-9 px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 disabled:opacity-40 text-xs font-extrabold text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span className="hidden xl:inline text-[11px]">Temizle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    toggleCurtain();
                  }}
                  title="🎭 Sürüklenebilir Tahta Perdesi"
                  className={`h-9 px-2.5 rounded-xl border text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    curtainOpen
                      ? "bg-amber-500 border-amber-700 text-slate-950 shadow-xs"
                      : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-amber-500"
                  }`}
                >
                  <Blinds size={14} className="shrink-0" />
                  <span>Perde</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    togglePicker();
                  }}
                  title="🎡 Sınıf Kura Çarkı (Öğrenci Seçici)"
                  className={`h-9 px-2.5 rounded-xl border text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    pickerOpen
                      ? "bg-[#6741D9] border-[#5230B5] text-white shadow-xs"
                      : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#6741D9]"
                  }`}
                >
                  <Dices size={14} className="shrink-0" />
                  <span>Kura</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    toggleTimer();
                  }}
                  title="⏱️ Ders Zamanlayıcısı ve Kronometre"
                  className={`h-9 px-2.5 rounded-xl border text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    timerOpen
                      ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                      : "bg-[#F7EFE1] dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#087F5B]"
                  }`}
                >
                  <Timer size={14} className="shrink-0" />
                  <span>
                    {timerRunning ? formatTimerClock(timerSeconds) : "Sayaç"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
