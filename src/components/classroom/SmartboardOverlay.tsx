"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MousePointer2,
  Pen,
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
  Minimize2,
  Maximize2,
  Play,
  Pause,
  RotateCcw,
  GripVertical,
  GripHorizontal,
  ArrowLeftRight,
  ArrowUpDown,
  Rows2,
  Columns2,
  LayoutGrid,
  Rows3,
  Users,
  Sparkles,
  Palette,
} from "lucide-react";
import {
  useClassroomToolsStore,
  SmartboardTool,
  IrabSemanticColorId,
  PenWidthPreset,
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

const ERASER_HIT_RADIUS_PX = 14;
const VIEWPORT_MARGIN_PX = 8;
const DRAG_THRESHOLD_PX = 6;

export interface Point2D {
  x: number;
  y: number;
}

export type DrawingElementKind =
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "circle"
  | "square"
  | "rect"
  | "triangle";

export interface DrawingElement {
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

/**
 * Bir noktanın (p) a->b doğru parçasına olan Öklid uzaklığını hesaplar.
 */
export function pointToSegmentDistance(
  p: Point2D,
  a: Point2D,
  b: Point2D
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function isNearPolygonEdges(
  pt: Point2D,
  vertices: Point2D[],
  closed: boolean,
  tolerance: number
): boolean {
  for (let i = 0; i < vertices.length - 1; i++) {
    if (pointToSegmentDistance(pt, vertices[i], vertices[i + 1]) <= tolerance) {
      return true;
    }
  }
  if (
    closed &&
    vertices.length >= 3 &&
    pointToSegmentDistance(pt, vertices[vertices.length - 1], vertices[0]) <=
      tolerance
  ) {
    return true;
  }
  return false;
}

/**
 * Silgi (Eraser) için tüm çizim ve geometrik şekilleri kapsayan gerçek çarpışma testi.
 * Serbest kalem, fosforlu kalem, düz çizgi, ok, dikdörtgen, kare, üçgen ve daire/elips şekillerini destekler.
 */
export function isItemHitByEraser(
  el: DrawingElement,
  pt: Point2D,
  hitRadius: number = ERASER_HIT_RADIUS_PX
): boolean {
  if (!el.points || el.points.length === 0) return false;
  const tolerance = hitRadius + (el.strokeWidth || 4) / 2;

  if (el.points.length === 1) {
    return Math.hypot(pt.x - el.points[0].x, pt.y - el.points[0].y) <= tolerance;
  }

  const p0 = el.points[0];
  const p1 = el.points[1];

  if (el.kind === "line" || el.kind === "arrow") {
    if (pointToSegmentDistance(pt, p0, p1) <= tolerance) {
      return true;
    }
    if (el.kind === "arrow") {
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const wingLen = Math.max(12, el.strokeWidth * 3);
      const leftWing: Point2D = {
        x: p1.x - wingLen * Math.cos(angle - Math.PI / 6),
        y: p1.y - wingLen * Math.sin(angle - Math.PI / 6),
      };
      const rightWing: Point2D = {
        x: p1.x - wingLen * Math.cos(angle + Math.PI / 6),
        y: p1.y - wingLen * Math.sin(angle + Math.PI / 6),
      };
      if (
        pointToSegmentDistance(pt, leftWing, p1) <= tolerance ||
        pointToSegmentDistance(pt, rightWing, p1) <= tolerance
      ) {
        return true;
      }
    }
    return false;
  }

  if (el.kind === "rect" || el.kind === "square") {
    const b =
      el.kind === "square"
        ? computeSquareBounds(p0, p1)
        : computeRectBounds(p0, p1);
    return isNearPolygonEdges(
      pt,
      [
        { x: b.x, y: b.y },
        { x: b.x + b.w, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
      ],
      true,
      tolerance
    );
  }

  if (el.kind === "triangle") {
    const b = computeRectBounds(p0, p1);
    return isNearPolygonEdges(
      pt,
      [
        { x: b.x + b.w / 2, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
      ],
      true,
      tolerance
    );
  }

  if (el.kind === "circle") {
    const b = computeRectBounds(p0, p1);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = Math.max(2, b.w / 2);
    const ry = Math.max(2, b.h / 2);
    const samplePts: Point2D[] = [];
    const steps = 48;
    for (let s = 0; s < steps; s++) {
      const ang = (s / steps) * Math.PI * 2;
      samplePts.push({
        x: cx + rx * Math.cos(ang),
        y: cy + ry * Math.sin(ang),
      });
    }
    return isNearPolygonEdges(pt, samplePts, true, tolerance);
  }

  return isNearPolygonEdges(pt, el.points, false, tolerance);
}

/**
 * Bir kutunun koordinatlarını her zaman [8px, viewport - size - 8px] aralığına kilitler.
 */
export function clampBoxToViewport(
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin: number = VIEWPORT_MARGIN_PX
): Point2D {
  const maxX = Math.max(margin, viewportWidth - boxWidth - margin);
  const maxY = Math.max(margin, viewportHeight - boxHeight - margin);
  return {
    x: Math.round(Math.min(maxX, Math.max(margin, x))),
    y: Math.round(Math.min(maxY, Math.max(margin, y))),
  };
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

  // Ekran boyutu takibi (Otomatik Tek Sıra / Çift Sıra ve taşma kilidi için)
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(
    () =>
      typeof window !== "undefined"
        ? { w: window.innerWidth, h: window.innerHeight }
        : { w: 1280, h: 800 }
  );

  // Çizim elemanları + Geri Al (Undo) geçmiş yığını
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [undoStack, setUndoStack] = useState<DrawingElement[][]>([]);
  const [draftElement, setDraftElement] = useState<DrawingElement | null>(null);
  const isPointerDrawingRef = useRef(false);
  const hasRecordedEraseSnapshotRef = useRef(false);

  // Silgi imleç halkası
  const [eraserCursor, setEraserCursor] = useState<Point2D | null>(null);

  // Açılır Renk & Çizgi Kalınlığı Mini Paleti + Yön + Tek/Çift Sıra Modu
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteFixedPos, setPaletteFixedPos] = useState<Point2D | null>(null);
  const [dockOrientation, setDockOrientation] = useState<
    "horizontal" | "vertical"
  >("vertical");
  // "auto": ekran < 860px ise otomatik Çift Sıra (2), büyük ekranda Tek Sıra (1); kullanıcı butondan istediği zaman değiştirebilir
  const [rowLayoutPref, setRowLayoutPref] = useState<"auto" | 1 | 2>("auto");

  const paletteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const palettePopoverRef = useRef<HTMLDivElement | null>(null);

  // Serbest Sürükle-Bırak (Hem 48x48 Küçültülmüş Kalem İkonu Hem Açık İkon Dock İçin)
  const [floatingPos, setFloatingPos] = useState<Point2D | null>(null);
  const dockBoxRef = useRef<HTMLDivElement | null>(null);
  const hasDraggedRef = useRef<boolean>(false);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originLeft: number;
    originTop: number;
  }>({
    active: false,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    originLeft: 0,
    originTop: 0,
  });

  // Bağımsız Sürüklenebilir Kronometre & Geri Sayım Kartı Konumu
  const [timerPos, setTimerPos] = useState<Point2D | null>(null);
  const timerCardRef = useRef<HTMLDivElement | null>(null);
  const timerDragRef = useRef<{
    active: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originLeft: number;
    originTop: number;
  }>({
    active: false,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    originLeft: 0,
    originTop: 0,
  });

  // Perde sürükleme referansı
  const isDraggingCurtainRef = useRef(false);

  // Sınıf Kura Çarkı State'leri (Sadece localStorage, sunucuya gitmez)
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

  // Ders Zamanlayıcısı (Geri Sayım / Kronometre) + Otomatik Kompakt Saat Kapsülü (Mini HUD) State'leri
  const [timerMode, setTimerMode] = useState<"countdown" | "stopwatch">(
    "countdown"
  );
  const [presetSeconds, setPresetSeconds] = useState<number>(60);
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerFinishedFlash, setTimerFinishedFlash] = useState<boolean>(false);
  const [isTimerCompact, setIsTimerCompact] = useState<boolean>(false);

  const isVertical = dockOrientation === "vertical";

  // Otomatik Tek Sıra (1) / Çift Sıra (2) Hesaplaması:
  // Dikeyde ekran yüksekliği < 860px (veya 880px dizüstü sınırı), yatayda ekran genişliği < 880px ise otomatik Çift Sıra (2x)
  const effectiveRows: 1 | 2 = useMemo(() => {
    if (rowLayoutPref !== "auto") return rowLayoutPref;
    if (isVertical) {
      return viewportSize.h < 880 ? 2 : 1;
    }
    return viewportSize.w < 900 ? 2 : 1;
  }, [rowLayoutPref, isVertical, viewportSize.h, viewportSize.w]);

  const isDoubleRow = effectiveRows === 2;

  // Pencere boyut değişimi, ESC ve dış tıklama dinleyicileri
  useEffect(() => {
    const handleViewportResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    const handleDocPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        palettePopoverRef.current &&
        !palettePopoverRef.current.contains(target) &&
        paletteTriggerRef.current &&
        !paletteTriggerRef.current.contains(target)
      ) {
        setPaletteOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    const handleWindowBlur = () => {
      isPointerDrawingRef.current = false;
      hasRecordedEraseSnapshotRef.current = false;
      dragStateRef.current.active = false;
      timerDragRef.current.active = false;
      setDraftElement(null);
      setEraserCursor(null);
    };
    handleViewportResize();
    window.addEventListener("resize", handleViewportResize);
    document.addEventListener("mousedown", handleDocPointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("resize", handleViewportResize);
      document.removeEventListener("mousedown", handleDocPointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  // SIFIR TAŞMA KİLİDİ (ResizeObserver + window.resize):
  // Çizim kutusu veya 48x48 kalem ikonu her boyutta [8px, innerWidth - width - 8px] x [8px, innerHeight - height - 8px] içinde kalır
  const enforceDockInViewport = useCallback(() => {
    const box = dockBoxRef.current;
    if (!box || typeof window === "undefined") return;
    const rect = box.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    setFloatingPos((prev) => {
      if (prev) {
        const clamped = clampBoxToViewport(
          prev.x,
          prev.y,
          rect.width,
          rect.height,
          vw,
          vh
        );
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        return clamped;
      }
      // Henüz sürüklenmemişse bile ekran sınırına taşıyorsa otomatik içeri kilitle
      if (
        rect.left < VIEWPORT_MARGIN_PX ||
        rect.top < VIEWPORT_MARGIN_PX ||
        rect.right > vw - VIEWPORT_MARGIN_PX ||
        rect.bottom > vh - VIEWPORT_MARGIN_PX
      ) {
        return clampBoxToViewport(
          rect.left,
          rect.top,
          rect.width,
          rect.height,
          vw,
          vh
        );
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(enforceDockInViewport);
    const box = dockBoxRef.current;
    let observer: ResizeObserver | null = null;
    if (box && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        enforceDockInViewport();
      });
      observer.observe(box);
    }
    window.addEventListener("resize", enforceDockInViewport);
    return () => {
      cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      window.removeEventListener("resize", enforceDockInViewport);
    };
  }, [
    isOpen,
    isCollapsed,
    dockOrientation,
    effectiveRows,
    enforceDockInViewport,
  ]);

  // Renk & Kalınlık Popover penceresini de ekran sınırları içinde tut ([8, vw - w - 8] x [8, vh - h - 8])
  const updatePalettePopoverPosition = useCallback(() => {
    if (!paletteOpen || typeof window === "undefined") return;
    const trigger = paletteTriggerRef.current;
    const pop = palettePopoverRef.current;
    if (!trigger) return;

    const tRect = trigger.getBoundingClientRect();
    const popW = pop ? pop.offsetWidth || 228 : 228;
    const popH = pop ? pop.offsetHeight || 226 : 226;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let rawX = tRect.left + tRect.width / 2 - popW / 2;
    let rawY = tRect.top - popH - 10;

    if (isVertical) {
      // Dikey çubuk ekranın sağ yarısındaysa sola, sol yarısındaysa sağa aç
      if (tRect.left > vw * 0.5) {
        rawX = tRect.left - popW - 10;
      } else {
        rawX = tRect.right + 10;
      }
      rawY = tRect.top + tRect.height / 2 - popH / 2;
    } else if (tRect.top < popH + 18) {
      rawY = tRect.bottom + 10;
    }

    setPaletteFixedPos(clampBoxToViewport(rawX, rawY, popW, popH, vw, vh));
  }, [paletteOpen, isVertical]);

  useEffect(() => {
    if (!paletteOpen) return;
    const raf = requestAnimationFrame(updatePalettePopoverPosition);
    const pop = palettePopoverRef.current;
    let observer: ResizeObserver | null = null;
    if (pop && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updatePalettePopoverPosition());
      observer.observe(pop);
    }
    window.addEventListener("resize", updatePalettePopoverPosition);
    return () => {
      cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      window.removeEventListener("resize", updatePalettePopoverPosition);
    };
  }, [
    paletteOpen,
    floatingPos,
    dockOrientation,
    effectiveRows,
    updatePalettePopoverPosition,
  ]);

  // Bağımsız Kronometre Penceresi için ResizeObserver + window.resize ekran içi kilidi
  const enforceTimerInViewport = useCallback(() => {
    const card = timerCardRef.current;
    if (!card || typeof window === "undefined") return;
    const rect = card.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    setTimerPos((prev) => {
      if (prev) {
        const clamped = clampBoxToViewport(
          prev.x,
          prev.y,
          rect.width,
          rect.height,
          vw,
          vh
        );
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        return clamped;
      }
      if (
        rect.left < VIEWPORT_MARGIN_PX ||
        rect.top < VIEWPORT_MARGIN_PX ||
        rect.right > vw - VIEWPORT_MARGIN_PX ||
        rect.bottom > vh - VIEWPORT_MARGIN_PX
      ) {
        return clampBoxToViewport(
          rect.left,
          rect.top,
          rect.width,
          rect.height,
          vw,
          vh
        );
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!timerOpen) return;
    const raf = requestAnimationFrame(enforceTimerInViewport);
    const card = timerCardRef.current;
    let observer: ResizeObserver | null = null;
    if (card && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => enforceTimerInViewport());
      observer.observe(card);
    }
    window.addEventListener("resize", enforceTimerInViewport);
    return () => {
      cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      window.removeEventListener("resize", enforceTimerInViewport);
    };
  }, [timerOpen, timerMode, isTimerCompact, enforceTimerInViewport]);

  // Sürükleme Başlangıcı (Tutamaca veya 48x48 Küçültülmüş Kalem İkonuna Basıldığında)
  const startDragGesture = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const box = dockBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    hasDraggedRef.current = false;
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
    };
  };

  const moveDragGesture = (e: React.PointerEvent<HTMLElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - st.startClientX;
    const dy = e.clientY - st.startClientY;
    const dist = Math.hypot(dx, dy);
    // <= 6px hareket = tıklama sayılır; > 6px hareket = sürükle ve ekran sınırlarında tut
    if (!hasDraggedRef.current && dist <= DRAG_THRESHOLD_PX) return;

    if (!hasDraggedRef.current) {
      hasDraggedRef.current = true;
      setPaletteOpen(false);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    e.preventDefault();

    const box = dockBoxRef.current;
    const boxW = box ? box.offsetWidth : 48;
    const boxH = box ? box.offsetHeight : 48;
    const nextPos = clampBoxToViewport(
      st.originLeft + dx,
      st.originTop + dy,
      boxW,
      boxH,
      window.innerWidth,
      window.innerHeight
    );
    setFloatingPos(nextPos);
  };

  const endDragGesture = (
    e: React.PointerEvent<HTMLElement>,
    onTapWithoutDrag?: () => void
  ) => {
    const st = dragStateRef.current;
    const wasActive = st.active && st.pointerId === e.pointerId;
    st.active = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    e.stopPropagation();
    if (wasActive && !hasDraggedRef.current && onTapWithoutDrag) {
      onTapWithoutDrag();
    }
    hasDraggedRef.current = false;
  };

  const cancelDragGesture = (e: React.PointerEvent<HTMLElement>) => {
    dragStateRef.current.active = false;
    hasDraggedRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    e.stopPropagation();
  };

  // Bağımsız Kronometre Kartı Sürükleme İşleyicileri
  const startTimerDrag = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const card = timerCardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    timerDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const moveTimerDrag = (e: React.PointerEvent<HTMLElement>) => {
    const st = timerDragRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - st.startClientX;
    const dy = e.clientY - st.startClientY;
    if (Math.hypot(dx, dy) <= 3) return;
    e.preventDefault();
    const card = timerCardRef.current;
    const w = card ? card.offsetWidth : 320;
    const h = card ? card.offsetHeight : 320;
    setTimerPos(
      clampBoxToViewport(
        st.originLeft + dx,
        st.originTop + dy,
        w,
        h,
        window.innerWidth,
        window.innerHeight
      )
    );
  };

  const endTimerDrag = (e: React.PointerEvent<HTMLElement>) => {
    timerDragRef.current.active = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    e.stopPropagation();
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

  // Ders Zamanlayıcısı Tiki
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

  const handleSwitchCountdownTab = () => {
    playClick();
    if (timerMode === "countdown") return;
    setTimerMode("countdown");
    setTimerSeconds(presetSeconds);
    setTimerRunning(false);
    setTimerFinishedFlash(false);
  };

  const handleSwitchStopwatch = () => {
    playClick();
    if (timerMode === "stopwatch") return;
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

  const handleToggleCompactTimerRun = () => {
    playClick();
    setTimerFinishedFlash(false);
    if (!timerRunning && timerMode === "countdown" && timerSeconds === 0) {
      setTimerSeconds(presetSeconds);
    }
    setTimerRunning((r) => !r);
  };

  const handleCompactResetTimer = () => {
    playClick();
    setTimerFinishedFlash(false);
    if (timerMode === "stopwatch") {
      setTimerRunning(false);
      setTimerSeconds(0);
    } else {
      const shouldRestartImmediately = timerRunning || timerSeconds === 0;
      setTimerSeconds(presetSeconds);
      setTimerRunning(shouldRestartImmediately);
    }
  };

  const handleCloseTimer = () => {
    playClick();
    setTimerRunning(false);
    setTimerFinishedFlash(false);
    setIsTimerCompact(false);
    setTimerOpen(false);
  };

  // Kura Çarkı Animasyonlu Seçim
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

  // Silgi: Dokunulan veya üzerinden geçilen tüm çizim/geometrik şekilleri anında sil + Undo geçmişine kaydet
  const eraseAtPoint = useCallback((pt: Point2D) => {
    setElements((prev) => {
      const remaining = prev.filter(
        (el) => !isItemHitByEraser(el, pt, ERASER_HIT_RADIUS_PX)
      );
      if (remaining.length !== prev.length) {
        if (!hasRecordedEraseSnapshotRef.current) {
          hasRecordedEraseSnapshotRef.current = true;
          setUndoStack((hist) => [...hist.slice(-39), prev]);
        }
        playFlip();
        return remaining;
      }
      return prev;
    });
  }, []);

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isOpen || isCollapsed || activeTool === "navigate") return;
    setPaletteOpen(false);
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    isPointerDrawingRef.current = true;

    const pt: Point2D = { x: e.clientX, y: e.clientY };

    if (activeTool === "eraser") {
      hasRecordedEraseSnapshotRef.current = false;
      setEraserCursor(pt);
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
    if (!isOpen || isCollapsed || activeTool === "navigate") return;
    const pt: Point2D = { x: e.clientX, y: e.clientY };

    if (activeTool === "eraser") {
      setEraserCursor(pt);
      if (isPointerDrawingRef.current) {
        e.preventDefault();
        eraseAtPoint(pt);
      }
      return;
    }

    if (!isPointerDrawingRef.current) return;
    e.preventDefault();

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
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (!isPointerDrawingRef.current) return;
    isPointerDrawingRef.current = false;
    hasRecordedEraseSnapshotRef.current = false;

    if (draftElement) {
      const shouldKeep =
        !isTwoPointGeometricKind(draftElement.kind) ||
        (draftElement.points.length >= 2 &&
          (draftElement.points[1].x - draftElement.points[0].x) ** 2 +
            (draftElement.points[1].y - draftElement.points[0].y) ** 2 >
            36);
      if (shouldKeep) {
        const committed = draftElement;
        setElements((prev) => {
          setUndoStack((hist) => [...hist.slice(-39), prev]);
          return [...prev, committed];
        });
      }
      setDraftElement(null);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    playClick();
    setUndoStack((hist) => {
      if (hist.length === 0) return hist;
      const previousSnapshot = hist[hist.length - 1];
      setElements(previousSnapshot);
      return hist.slice(0, -1);
    });
  };

  const handleClearAll = () => {
    if (elements.length === 0) return;
    playClick();
    setUndoStack((hist) => [...hist.slice(-39), elements]);
    setElements([]);
    setDraftElement(null);
  };

  // Tahta Perdesi Tutamaç Sürükleme
  const handleCurtainPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
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

  // Silgi imleci şeklin üzerindeyse hafif soluklaştırma önizlemesi
  const hoveredEraserIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isOpen || isCollapsed || activeTool !== "eraser" || !eraserCursor) {
      return ids;
    }
    for (const el of elements) {
      if (isItemHitByEraser(el, eraserCursor, ERASER_HIT_RADIUS_PX)) {
        ids.add(el.id);
      }
    }
    return ids;
  }, [isOpen, isCollapsed, activeTool, eraserCursor, elements]);

  if (!isOpen && !timerOpen && !pickerOpen && !curtainOpen) return null;

  const isDrawingInteractive =
    isOpen && !isCollapsed && activeTool !== "navigate";
  const allRenderedElements = draftElement
    ? [...elements, draftElement]
    : elements;

  // Tooltip yönü: Dock ekranın üst yarısındaysa alta, alt yarısındaysa üste; dikeyse sağa/sola açılır
  const isNearTop =
    floatingPos !== null && floatingPos.y < 120;
  const isNearRight =
    floatingPos === null
      ? isVertical || isCollapsed
      : floatingPos.x > viewportSize.w * 0.5;

  const dockTooltipPos: "top" | "bottom" | "left" | "right" = isVertical
    ? isNearRight
      ? "left"
      : "right"
    : isNearTop
    ? "bottom"
    : "top";

  const dockContainerClasses = floatingPos
    ? "fixed z-[90] pointer-events-auto max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)]"
    : isCollapsed
    ? "fixed bottom-20 lg:bottom-5 right-3 sm:right-5 z-[90] pointer-events-auto"
    : isVertical
    ? "fixed right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-[90] pointer-events-auto max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)]"
    : "fixed bottom-18 lg:bottom-4 left-1/2 -translate-x-1/2 z-[90] pointer-events-auto max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)]";

  const iconBtnBase =
    "w-[38px] h-[38px] min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0";

  const handleToggleRowCount = () => {
    playClick();
    setPaletteOpen(false);
    setRowLayoutPref(isDoubleRow ? 1 : 2);
  };

  const handleToggleOrientation = () => {
    playClick();
    setPaletteOpen(false);
    setDockOrientation((prev) =>
      prev === "horizontal" ? "vertical" : "horizontal"
    );
  };

  return (
    <div className="print:hidden">
      {/* =================================================================== */}
      {/* 1. DOM DOSTU BAĞIMSIZ SVG ÇİZİM VE GEOMETRİK ŞEKİL KATMANI (z-[80]) */}
      {/* =================================================================== */}
      {isOpen && (
        <svg
          aria-label="Akıllı Tahta Çizim ve Şekil Katmanı"
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerCancel={handleSvgPointerUp}
          onPointerLeave={() => setEraserCursor(null)}
          className={`fixed inset-0 w-screen h-screen z-[80] select-none ${
            isDrawingInteractive
              ? activeTool === "eraser"
                ? "pointer-events-auto touch-none cursor-none"
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
            const isEraserHovered = hoveredEraserIds.has(el.id);

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
                    opacity={isEraserHovered ? 0.28 : 1}
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
                    opacity={isEraserHovered ? 0.28 : 1}
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
                    opacity={isEraserHovered ? 0.28 : 1}
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
                    opacity={isEraserHovered ? 0.28 : 1}
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
                    opacity={isEraserHovered ? 0.28 : 1}
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
                  opacity={
                    isEraserHovered ? 0.14 : isDark ? 0.36 : 0.42
                  }
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
                opacity={isEraserHovered ? 0.28 : 1}
              />
            );
          })}

          {/* Silgi Aktifken Yarı Saydam Yuvarlak Silgi Halkası */}
          {!isCollapsed && activeTool === "eraser" && eraserCursor && (
            <g className="pointer-events-none">
              <circle
                cx={eraserCursor.x}
                cy={eraserCursor.y}
                r={ERASER_HIT_RADIUS_PX}
                fill={
                  hoveredEraserIds.size > 0
                    ? "rgba(244, 63, 94, 0.22)"
                    : "rgba(15, 23, 42, 0.08)"
                }
                stroke={hoveredEraserIds.size > 0 ? "#E11D48" : "#475569"}
                strokeWidth={2}
                strokeDasharray="3 2"
              />
            </g>
          )}
        </svg>
      )}

      {/* =================================================================== */}
      {/* 2. SÜRÜKLENEBİLİR TAHTA PERDESİ (SCREEN SHADE / CURTAIN — z-[82])   */}
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
          className="fixed z-[82] bg-gradient-to-br from-[#064E3B] via-[#0F172A] to-[#1E293B] text-white shadow-2xl border-emerald-400/70 flex flex-col select-none"
        >
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
                  Tahta Perdesi — Açmak için tutamaçtan aşağı kaydırın
                </span>
              ) : (
                <span className="writing-mode-vertical text-center text-xs">
                  Perde
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
      {/* 3. BAĞIMSIZ SÜRÜKLENEBİLİR DERS SAYACI & KOMPAKT MİNİ HUD (z-[92])  */}
      {/* Çizim kutusu kapalı veya kalem ikonuna küçültülmüş olsa da çalışır! */}
      {/* =================================================================== */}
      {timerOpen && (
        <div
          ref={timerCardRef}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={
            timerPos
              ? {
                  left: `${timerPos.x}px`,
                  top: `${timerPos.y}px`,
                }
              : undefined
          }
          className={`${
            timerPos
              ? "fixed z-[92]"
              : "fixed top-15 lg:top-17 right-2 sm:right-5 z-[92]"
          } pointer-events-auto max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)]`}
        >
          {isTimerCompact ? (
            /* KOMPAKT SAAT KAPSÜLÜ (MİNİ HUD): Hafif Transparan Buzlu Cam + %100 Net Rakamlar */
            <div
              onPointerDown={startTimerDrag}
              onPointerMove={moveTimerDrag}
              onPointerUp={endTimerDrag}
              onPointerCancel={endTimerDrag}
              className={`relative touch-none cursor-grab active:cursor-grabbing bg-slate-900/78 dark:bg-slate-950/82 backdrop-blur-md border shadow-xl rounded-2xl px-3.5 py-2 text-white select-none flex items-center gap-2.5 overflow-visible transition-colors ${
                timerFinishedFlash
                  ? "border-amber-400 ring-2 ring-amber-400/60"
                  : "border-white/20"
              }`}
            >
              {/* Rakam Göstergesi (Sürüklenebilir Gövde) */}
              <div
                className={`font-mono tabular-nums font-extrabold text-2xl sm:text-3xl tracking-wider leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] ${
                  timerFinishedFlash
                    ? "text-amber-300"
                    : timerMode === "countdown" &&
                      timerSeconds > 0 &&
                      timerSeconds <= 5
                    ? "text-rose-400 animate-pulse"
                    : timerMode === "countdown" &&
                      timerSeconds > 5 &&
                      timerSeconds <= 10
                    ? "text-amber-300"
                    : "text-white"
                }`}
              >
                {formatTimerClock(timerSeconds)}
              </div>

              {/* Metinsiz Küçük Kontrol İkonları */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1 pl-1.5 border-l border-white/15 shrink-0 overflow-visible"
              >
                {/* 1) Duraklat / Devam Et */}
                <button
                  type="button"
                  onClick={handleToggleCompactTimerRun}
                  aria-label="Duraklat / Devam Et"
                  data-tooltip="Duraklat / Devam Et"
                  data-tooltip-pos={
                    !timerPos || timerPos.y < 100 ? "bottom" : "top"
                  }
                  className="w-7 h-7 rounded-lg hover:bg-white/15 text-white/85 hover:text-white transition flex items-center justify-center cursor-pointer shrink-0"
                >
                  {timerRunning ? (
                    <Pause size={15} strokeWidth={2.3} />
                  ) : (
                    <Play size={15} strokeWidth={2.3} />
                  )}
                </button>

                {/* 2) Sıfırla / Baştan Başlat */}
                <button
                  type="button"
                  onClick={handleCompactResetTimer}
                  aria-label="Sıfırla / Baştan Başlat"
                  data-tooltip="Sıfırla / Baştan Başlat"
                  data-tooltip-pos={
                    !timerPos || timerPos.y < 100 ? "bottom" : "top"
                  }
                  className="w-7 h-7 rounded-lg hover:bg-white/15 text-white/85 hover:text-white transition flex items-center justify-center cursor-pointer shrink-0"
                >
                  <RotateCcw size={15} strokeWidth={2.2} />
                </button>

                {/* 3) Tam Kartı Aç (Sayacı Durdurmadan) */}
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setIsTimerCompact(false);
                  }}
                  aria-label="Sayaç Kartını Tam Aç"
                  data-tooltip="Sayaç Kartını Tam Aç"
                  data-tooltip-pos={
                    !timerPos || timerPos.y < 100 ? "bottom" : "top"
                  }
                  className="w-7 h-7 rounded-lg hover:bg-white/15 text-white/85 hover:text-white transition flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Maximize2 size={15} strokeWidth={2.2} />
                </button>

                {/* 4) Sayacı Kapat */}
                <button
                  type="button"
                  onClick={handleCloseTimer}
                  aria-label="Sayacı Kapat"
                  data-tooltip="Sayacı Kapat"
                  data-tooltip-pos={
                    !timerPos || timerPos.y < 100 ? "bottom" : "top"
                  }
                  data-tooltip-align="right"
                  className="w-7 h-7 rounded-lg hover:bg-rose-500/25 text-white/75 hover:text-rose-300 transition flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X size={15} strokeWidth={2.3} />
                </button>
              </div>

              {/* Geri Sayım Modunda Alt Kenarda 2px İnce Kalan Süre İlerleme Çizgisi */}
              {timerMode === "countdown" && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-3 bottom-[3px] h-[2px] rounded-full bg-white/15 overflow-hidden"
                >
                  <div
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          (timerSeconds / Math.max(1, presetSeconds)) * 100
                        )
                      )}%`,
                    }}
                    className={`h-full rounded-full transition-opacity duration-200 ${
                      timerSeconds <= 5
                        ? "bg-rose-400"
                        : timerSeconds <= 10
                        ? "bg-amber-300"
                        : "bg-emerald-400"
                    }`}
                  />
                </div>
              )}
            </div>
          ) : (
            /* TAM AYAR KARTI GÖRÜNÜMÜ */
            <div
              className={`w-[min(340px,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-3xl border-2 border-b-4 shadow-2xl p-3.5 space-y-3 transition-colors ${
                timerFinishedFlash
                  ? "bg-amber-50 dark:bg-amber-950 border-amber-500 ring-4 ring-amber-400/50"
                  : "bg-[#FDFBF7] dark:bg-slate-900 border-[#087F5B]"
              }`}
            >
              {/* Sürüklenebilir Üst Başlık + Kura + Küçült + Kapat */}
              <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#E2D3B8] dark:border-slate-800 pb-2">
                <div
                  onPointerDown={startTimerDrag}
                  onPointerMove={moveTimerDrag}
                  onPointerUp={endTimerDrag}
                  onPointerCancel={endTimerDrag}
                  title="Sayacı taşımak için sürükleyin"
                  className="touch-none select-none cursor-grab active:cursor-grabbing flex items-center gap-2 min-w-0 flex-1 py-0.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
                    <Timer size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] flex items-center gap-1 whitespace-nowrap">
                      <span>Ders Sayacı</span>
                      <GripHorizontal
                        size={14}
                        className="text-slate-400 shrink-0"
                      />
                    </h3>
                    <p className="text-[10px] font-bold text-[var(--muted)] truncate">
                      Taşımak için başlığı sürükleyin
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setPickerOpen(true);
                    }}
                    data-tooltip="Sınıf Kura Çarkını Aç"
                    data-tooltip-pos="bottom"
                    aria-label="Sınıf Kura Çarkını Aç"
                    className="min-h-[36px] px-2.5 rounded-xl bg-[#F3F0FF] dark:bg-purple-950/60 border border-[#6741D9]/45 text-[#5230B5] dark:text-purple-300 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer hover:bg-[#6741D9]/15"
                  >
                    <Dices size={14} />
                    <span>Kura</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setIsTimerCompact(true);
                    }}
                    data-tooltip="Kompakt Saat Görünümü"
                    data-tooltip-pos="bottom"
                    aria-label="Kompakt Saat Görünümü"
                    className="min-w-[36px] min-h-[36px] rounded-xl bg-white dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-center text-[var(--muted)] hover:text-[#087F5B] dark:hover:text-emerald-300 cursor-pointer"
                  >
                    <Minimize2 size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseTimer}
                    aria-label="Zamanlayıcıyı Kapat"
                    className="min-w-[36px] min-h-[36px] rounded-xl bg-white dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-center text-[var(--muted)] hover:text-rose-600 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* İki Sekmeli Mod Seçici: Geri Sayım | Kronometre (İleri Sayım) */}
              <div
                role="tablist"
                aria-label="Zamanlayıcı Modu"
                className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={timerMode === "countdown"}
                  onClick={handleSwitchCountdownTab}
                  className={`min-h-[40px] rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    timerMode === "countdown"
                      ? "bg-[#087F5B] text-white shadow-xs"
                      : "text-[var(--foreground)] hover:bg-white/70 dark:hover:bg-slate-700/60"
                  }`}
                >
                  ⏳ Geri Sayım
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={timerMode === "stopwatch"}
                  onClick={handleSwitchStopwatch}
                  className={`min-h-[40px] rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    timerMode === "stopwatch"
                      ? "bg-[#6741D9] text-white shadow-xs"
                      : "text-[var(--foreground)] hover:bg-white/70 dark:hover:bg-slate-700/60"
                  }`}
                >
                  ⏱️ Kronometre
                </button>
              </div>

              {/* Dijital Saat Göstergesi */}
              <div className="rounded-2xl bg-[#F7EFE1] dark:bg-slate-800/90 border border-[#E6D7BE] dark:border-slate-700 py-3 px-4 text-center">
                <div
                  className={`font-mono text-4xl sm:text-5xl font-black tabular-nums tracking-wider ${
                    timerFinishedFlash
                      ? "text-amber-700 dark:text-amber-300 animate-pulse"
                      : timerMode === "countdown" &&
                        timerSeconds > 0 &&
                        timerSeconds <= 5
                      ? "text-rose-600 dark:text-rose-400 animate-pulse"
                      : timerMode === "countdown" &&
                        timerSeconds > 5 &&
                        timerSeconds <= 10
                      ? "text-amber-600 dark:text-amber-400"
                      : timerMode === "stopwatch"
                      ? "text-[#5230B5] dark:text-purple-300"
                      : "text-[#065F46] dark:text-emerald-300"
                  }`}
                >
                  {formatTimerClock(timerSeconds)}
                </div>
                {timerFinishedFlash ? (
                  <p className="text-xs font-extrabold text-amber-800 dark:text-amber-200 mt-1">
                    Süre Tamamlandı!
                  </p>
                ) : (
                  <p className="text-[11px] font-semibold text-[var(--muted)] mt-0.5">
                    {timerMode === "countdown"
                      ? "Seçilen süreden geriye sayar"
                      : "00:00 başlangıçtan ileri sayar"}
                  </p>
                )}
              </div>

              {/* Geri Sayım Hızlı Süre Butonları (30 sn, 1 dk, 2 dk, 3 dk, 5 dk, 10 dk) */}
              {timerMode === "countdown" && (
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { sec: 30, label: "30 sn" },
                    { sec: 60, label: "1 dk" },
                    { sec: 120, label: "2 dk" },
                    { sec: 180, label: "3 dk" },
                    { sec: 300, label: "5 dk" },
                    { sec: 600, label: "10 dk" },
                  ].map((p) => {
                    const active = presetSeconds === p.sec;
                    return (
                      <button
                        key={p.sec}
                        type="button"
                        onClick={() => handleSelectCountdownPreset(p.sec)}
                        className={`min-h-[44px] rounded-xl border text-xs font-extrabold transition-all cursor-pointer tabular-nums ${
                          active
                            ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                            : "bg-white dark:bg-slate-800 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] hover:border-[#087F5B]"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Başlat (Otomatik Kompakt Kapsüle Geçer) / Duraklat / Sıfırla */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setTimerFinishedFlash(false);
                    if (timerRunning) {
                      setTimerRunning(false);
                    } else {
                      if (timerMode === "countdown" && timerSeconds === 0) {
                        setTimerSeconds(presetSeconds);
                      }
                      setTimerRunning(true);
                      setIsTimerCompact(true);
                    }
                  }}
                  className={`min-h-[48px] rounded-xl font-extrabold text-xs text-white border-b-3 flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    timerRunning
                      ? "bg-amber-600 hover:bg-amber-700 border-amber-800"
                      : timerMode === "stopwatch"
                      ? "bg-[#6741D9] hover:bg-[#5230B5] border-[#422399]"
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
                  className="min-h-[48px] rounded-xl bg-white dark:bg-slate-800 border-2 border-[#E6D7BE] dark:border-slate-700 text-xs font-extrabold text-[var(--foreground)] flex items-center justify-center gap-1.5 cursor-pointer hover:border-[#087F5B]"
                >
                  <RotateCcw size={15} />
                  <span>Sıfırla</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. BAĞIMSIZ SINIF KURA ÇARKI (RANDOM STUDENT PICKER — z-[95])       */}
      {/* Çizim aracı kapalıyken de üst bardan/menüden tek başına açılır!     */}
      {/* =================================================================== */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-[95] pointer-events-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[min(32rem,calc(100vw-16px))] rounded-3xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-16px)]"
          >
            <div className="bg-[#F7EFE1] dark:bg-[var(--background)] px-4 sm:px-5 py-3 border-b-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#6741D9] text-white flex items-center justify-center shrink-0">
                  <Dices size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] truncate">
                    Sınıf Kura Çarkı (Öğrenci Seçici)
                  </h3>
                  <p className="text-[11px] font-semibold text-[var(--muted)] truncate">
                    İsimler yalnızca bu cihazda tutulur; sunucuya gönderilmez.
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
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer shrink-0"
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
                  <span>Numara Aralığı (1–35)</span>
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
                  <span>Sınıf Listesi Yapıştır</span>
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
                      className="w-20 min-h-[48px] px-3 rounded-xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] text-center font-black text-sm tabular-nums"
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
                      className="w-20 min-h-[48px] px-3 rounded-xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] text-center font-black text-sm tabular-nums"
                    />
                  </div>
                  <span className="text-xs font-bold text-[#065F46] dark:text-emerald-400 tabular-nums">
                    Toplam {fullCandidatePool.length} Öğrenci
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[var(--foreground)]">
                      Her satıra bir öğrenci adı yazın ({fullCandidatePool.length} kişi):
                    </span>
                    {rosterText.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearRoster}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-xs font-extrabold cursor-pointer"
                      >
                        Listeyi Sil
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
                    <span className="text-xs font-extrabold text-emerald-200 mb-1">
                      Kura Çekiliyor...
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
                    Söz hakkı vermek için aşağıdaki &ldquo;Öğrenci Seç&rdquo; butonuna dokunun.
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
                  <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
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
                        Turu Sıfırla
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
                <span>Öğrenci Seç</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. EKRAN İÇİNE KİLİTLİ RENK & ÇİZGİ KALINLIĞI POPOVER PENCERESİ     */}
      {/* =================================================================== */}
      {isOpen && !isCollapsed && paletteOpen && (
        <div
          ref={palettePopoverRef}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={
            paletteFixedPos
              ? {
                  left: `${paletteFixedPos.x}px`,
                  top: `${paletteFixedPos.y}px`,
                }
              : { left: "16px", top: "64px" }
          }
          className="fixed z-[96] pointer-events-auto w-[min(228px,calc(100vw-16px))] rounded-2xl backdrop-blur-md bg-white/98 dark:bg-slate-900/98 border border-stone-200 dark:border-slate-700 shadow-2xl p-3 space-y-3"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Çizim Rengi</span>
              <label
                title="Özel Renk Seç"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Palette size={12} />
                <span>Özel</span>
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
            </div>

            <div className="grid grid-cols-5 gap-2 pt-0.5">
              {BOARD_COLOR_SWATCHES.map((sw) => {
                const isSelected =
                  activeColorHex.toUpperCase() === sw.hex.toUpperCase();
                return (
                  <button
                    key={sw.hex}
                    type="button"
                    aria-label={`Renk: ${sw.label}`}
                    data-tooltip={sw.label}
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
                    className={`w-7 h-7 rounded-full cursor-pointer transition-transform mx-auto ${
                      sw.hex === "#FFFFFF"
                        ? "border-2 border-slate-400"
                        : "border border-black/15"
                    } ${
                      isSelected
                        ? "ring-2 ring-offset-2 ring-[#6741D9] dark:ring-offset-slate-900 scale-110"
                        : "hover:scale-105"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-stone-200/80 dark:border-slate-800">
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Çizgi Kalınlığı
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  {
                    id: "thin" as PenWidthPreset,
                    label: "İnce",
                    barH: "h-[2px]",
                  },
                  {
                    id: "medium" as PenWidthPreset,
                    label: "Orta",
                    barH: "h-[4px]",
                  },
                  {
                    id: "thick" as PenWidthPreset,
                    label: "Kalın",
                    barH: "h-[7px]",
                  },
                ] as const
              ).map((w) => {
                const active = penWidth === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setPenWidth(w.id);
                    }}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      active
                        ? "bg-[#6741D9]/12 border-[#6741D9] text-[#6741D9] dark:text-purple-300"
                        : "bg-stone-50 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <span
                      className={`w-7 rounded-full bg-current ${w.barH}`}
                    />
                    <span>{w.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. PROFESYONEL METİNSİZ İKON DOCK & 48x48 YUVARLAK KALEM İKONU      */}
      {/* =================================================================== */}
      {isOpen && (
        <div
          ref={dockBoxRef}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
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
            /* KÜÇÜLTÜLMÜŞ DURUM: 48x48px Sürüklenebilir Yuvarlak Kalem İkonu (Çizimleri Silmez!) */
            <button
              type="button"
              aria-label="Çizim Araçlarını Aç"
              data-tooltip="Çizim Araçlarını Aç (Taşımak için sürükleyin)"
              data-tooltip-pos={isNearTop ? "bottom" : "top"}
              data-tooltip-align={isNearRight ? "right" : undefined}
              onPointerDown={startDragGesture}
              onPointerMove={moveDragGesture}
              onPointerUp={(e) =>
                endDragGesture(e, () => {
                  playClick();
                  setCollapsed(false);
                })
              }
              onPointerCancel={cancelDragGesture}
              onClick={(e) => {
                if (e.detail === 0) {
                  playClick();
                  setCollapsed(false);
                }
              }}
              className="touch-none select-none cursor-grab active:cursor-grabbing relative w-[48px] h-[48px] rounded-full backdrop-blur-md bg-[#087F5B]/95 hover:bg-[#065F46] text-white border-2 border-white/90 dark:border-emerald-300/80 shadow-2xl flex items-center justify-center transition-transform hover:scale-105"
            >
              <Pen size={21} strokeWidth={2.3} />
              <span
                aria-hidden="true"
                style={{ backgroundColor: activeColorHex }}
                className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-xs"
              />
            </button>
          ) : (
            /* AÇIK DURUM: Kontrol Butonları EN ÜSTTE/BAŞTA + Tek Sıra (1x) / Çift Sıra (2x) İkon Dock */
            <div
              className={`backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border border-stone-200/90 dark:border-slate-700 shadow-2xl rounded-2xl p-1.5 flex ${
                isVertical ? "flex-col items-center gap-1" : "flex-row items-center gap-1"
              } max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-visible`}
            >
              {/* =========================================================== */}
              {/* EN ÜST / BAŞ KONTROL GRUBU: Sürükle, Küçült, 1x/2x, Yön, ✕ */}
              {/* Hiçbir ekran boyutunda taşmaz ve her zaman ulaşılır!        */}
              {/* =========================================================== */}
              <div
                className={`shrink-0 flex ${
                  isVertical
                    ? isDoubleRow
                      ? "flex-col items-center gap-1 w-full pb-1 border-b border-stone-200 dark:border-slate-700"
                      : "flex-col items-center gap-1 pb-1 border-b border-stone-200 dark:border-slate-700"
                    : isDoubleRow && viewportSize.w >= 460
                    ? "flex-row items-center gap-1 pr-1.5 border-r border-stone-200 dark:border-slate-700"
                    : "flex-row items-center gap-1 pr-1 border-r border-stone-200 dark:border-slate-700"
                }`}
              >
                {/* Sürükleme Tutamacı */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Araç Çubuğunu Sürükle"
                  data-tooltip="Araç Çubuğunu Sürükle"
                  data-tooltip-pos={dockTooltipPos}
                  onPointerDown={startDragGesture}
                  onPointerMove={moveDragGesture}
                  onPointerUp={(e) => endDragGesture(e)}
                  onPointerCancel={cancelDragGesture}
                  className={`touch-none select-none cursor-grab active:cursor-grabbing rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 shrink-0 ${
                    isVertical && isDoubleRow
                      ? "w-full h-6"
                      : isVertical
                      ? "w-[38px] h-7"
                      : "w-7 h-[38px]"
                  }`}
                >
                  {isVertical ? (
                    <GripHorizontal size={16} strokeWidth={2.2} />
                  ) : (
                    <GripVertical size={17} strokeWidth={2.2} />
                  )}
                </div>

                {/* 4 Üst Yönetim Butonu: Küçült (Kalem İkonu), Tek/Çift Sıra, Yatay/Dikey, Kapat */}
                <div
                  className={
                    isVertical && isDoubleRow
                      ? "grid grid-cols-2 gap-1.5"
                      : !isVertical && isDoubleRow && viewportSize.w >= 460
                      ? "grid grid-rows-2 grid-flow-col gap-1.5"
                      : isVertical
                      ? "flex flex-col items-center gap-1"
                      : "flex flex-row items-center gap-1"
                  }
                >
                  {/* 1) Küçült (Sadece Kalem İkonuna Dönüştür) */}
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setPaletteOpen(false);
                      setCollapsed(true);
                    }}
                    aria-label="Sadece Kalem İkonuna Küçült"
                    data-tooltip="Sadece Kalem İkonuna Küçült"
                    data-tooltip-pos={dockTooltipPos}
                    className={`${iconBtnBase} bg-emerald-50/80 dark:bg-emerald-950/40 text-[#065F46] dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60`}
                  >
                    <Minimize2 size={17} strokeWidth={2.2} />
                  </button>

                  {/* 2) Tek Sıra (1x) / Çift Sıra (2x Kompakt Izgara) Görünüm Değiştir */}
                  <button
                    type="button"
                    onClick={handleToggleRowCount}
                    aria-label="Tek Sıra / Çift Sıra Görünüm"
                    aria-pressed={isDoubleRow}
                    data-tooltip="Tek Sıra / Çift Sıra Görünüm"
                    data-tooltip-pos={dockTooltipPos}
                    className={`${iconBtnBase} ${
                      isDoubleRow
                        ? "bg-[#6741D9]/15 text-[#5230B5] dark:text-purple-300 ring-1 ring-[#6741D9]/40"
                        : "text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {isDoubleRow ? (
                      <Rows3 size={17} strokeWidth={2.2} />
                    ) : (
                      <LayoutGrid size={17} strokeWidth={2.2} />
                    )}
                  </button>

                  {/* 3) Yatay / Dikey Konum Değiştir */}
                  <button
                    type="button"
                    onClick={handleToggleOrientation}
                    aria-label={
                      isVertical ? "Yatay Araç Çubuğu" : "Dikey Araç Çubuğu"
                    }
                    data-tooltip={
                      isVertical
                        ? "Yatay Araç Çubuğuna Geç"
                        : "Dikey Araç Çubuğuna Geç"
                    }
                    data-tooltip-pos={dockTooltipPos}
                    className={`${iconBtnBase} text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800`}
                  >
                    {isVertical ? (
                      <Rows2 size={17} strokeWidth={2.2} />
                    ) : (
                      <Columns2 size={17} strokeWidth={2.2} />
                    )}
                  </button>

                  {/* 4) ✕ Kapat */}
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setPaletteOpen(false);
                      closeToolbar();
                    }}
                    aria-label="Tahta Araçlarını Kapat"
                    data-tooltip="Tahta Araçlarını Kapat"
                    data-tooltip-pos={dockTooltipPos}
                    className={`${iconBtnBase} text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60`}
                  >
                    <X size={18} strokeWidth={2.3} />
                  </button>
                </div>
              </div>

              {/* =========================================================== */}
              {/* 16 ÇİZİM, ŞEKİL VE SINIF ARACI İKONU (1x veya 2x Izgara)   */}
              {/* =========================================================== */}
              <div
                className={
                  isVertical
                    ? isDoubleRow
                      ? "grid grid-cols-2 gap-1.5 overflow-y-auto max-h-[calc(100dvh-148px)]"
                      : "flex flex-col items-center gap-1 overflow-y-auto max-h-[calc(100dvh-210px)]"
                    : isDoubleRow
                    ? viewportSize.w >= 460
                      ? "grid grid-rows-2 grid-flow-col gap-1.5 overflow-x-auto max-w-[calc(100vw-130px)]"
                      : "flex flex-wrap items-center justify-center gap-1 max-w-[calc(100vw-110px)]"
                    : "flex flex-row items-center gap-1 overflow-x-auto max-w-[calc(100vw-210px)]"
                }
              >
                {/* BÖLÜM 1: Temel Araçlar (Gezin, Kalem, Fosforlu, Silgi) */}
                {(
                  [
                    {
                      id: "navigate" as SmartboardTool,
                      tooltip: "Gezin / Tıklama Modu",
                      icon: MousePointer2,
                    },
                    {
                      id: "pen" as SmartboardTool,
                      tooltip: "Kalem",
                      icon: Pen,
                    },
                    {
                      id: "highlighter" as SmartboardTool,
                      tooltip: "Fosforlu Kalem",
                      icon: Highlighter,
                    },
                    {
                      id: "eraser" as SmartboardTool,
                      tooltip: "Silgi",
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
                      aria-label={tool.tooltip}
                      aria-pressed={active}
                      data-tooltip={tool.tooltip}
                      data-tooltip-pos={dockTooltipPos}
                      onClick={() => {
                        playClick();
                        setPaletteOpen(false);
                        setActiveTool(tool.id);
                      }}
                      className={`${iconBtnBase} ${
                        active
                          ? tool.id === "navigate"
                            ? "bg-[#087F5B] text-white shadow-xs"
                            : tool.id === "eraser"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-[#6741D9] text-white shadow-xs"
                          : "text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon size={18} strokeWidth={2.2} />
                    </button>
                  );
                })}

                {/* BÖLÜM 2: Geometrik Şekiller (Çizgi, Ok, Dikdörtgen, Kare, Daire, Üçgen) */}
                {(
                  [
                    {
                      id: "line" as SmartboardTool,
                      tooltip: "Düz Çizgi",
                      icon: Minus,
                      diagonal: true,
                    },
                    {
                      id: "arrow" as SmartboardTool,
                      tooltip: "Ok",
                      icon: MoveUpRight,
                      diagonal: false,
                    },
                    {
                      id: "rect" as SmartboardTool,
                      tooltip: "Dikdörtgen",
                      icon: RectangleHorizontal,
                      diagonal: false,
                    },
                    {
                      id: "square" as SmartboardTool,
                      tooltip: "Kare",
                      icon: Square,
                      diagonal: false,
                    },
                    {
                      id: "circle" as SmartboardTool,
                      tooltip: "Daire",
                      icon: Circle,
                      diagonal: false,
                    },
                    {
                      id: "triangle" as SmartboardTool,
                      tooltip: "Üçgen",
                      icon: Triangle,
                      diagonal: false,
                    },
                  ] as const
                ).map((shape) => {
                  const Icon = shape.icon;
                  const active = activeTool === shape.id;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      aria-label={shape.tooltip}
                      aria-pressed={active}
                      data-tooltip={shape.tooltip}
                      data-tooltip-pos={dockTooltipPos}
                      onClick={() => {
                        playClick();
                        setPaletteOpen(false);
                        setActiveTool(shape.id);
                      }}
                      className={`${iconBtnBase} ${
                        active
                          ? "bg-[#6741D9] text-white shadow-xs"
                          : "text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon
                        size={18}
                        strokeWidth={2.2}
                        className={shape.diagonal ? "-rotate-45" : undefined}
                      />
                    </button>
                  );
                })}

                {/* BÖLÜM 3: Tek Butonda Açılır Renk & Çizgi Kalınlığı Tetikleyicisi */}
                <button
                  ref={paletteTriggerRef}
                  type="button"
                  aria-label="Renk ve Çizgi Kalınlığı"
                  aria-expanded={paletteOpen}
                  data-tooltip="Renk ve Çizgi Kalınlığı"
                  data-tooltip-pos={dockTooltipPos}
                  onClick={() => {
                    playClick();
                    setPaletteOpen((o) => !o);
                  }}
                  className={`${iconBtnBase} ${
                    paletteOpen
                      ? "bg-stone-200/80 dark:bg-slate-800 ring-2 ring-[#6741D9]"
                      : "hover:bg-stone-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span
                    style={{ backgroundColor: activeColorHex }}
                    className={`rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${
                      activeColorHex.toUpperCase() === "#FFFFFF"
                        ? "ring-slate-400 border border-slate-300"
                        : "ring-stone-300 dark:ring-slate-600"
                    } ${
                      penWidth === "thin"
                        ? "w-4 h-4"
                        : penWidth === "medium"
                        ? "w-5 h-5"
                        : "w-6 h-6"
                    }`}
                  />
                </button>

                {/* BÖLÜM 4A: Geri Al & Tüm Çizimleri Temizle */}
                <button
                  type="button"
                  disabled={undoStack.length === 0}
                  onClick={handleUndo}
                  aria-label="Geri Al"
                  data-tooltip="Geri Al"
                  data-tooltip-pos={dockTooltipPos}
                  className={`${iconBtnBase} disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800`}
                >
                  <Undo2 size={18} strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  disabled={elements.length === 0}
                  onClick={handleClearAll}
                  aria-label="Tüm Çizimleri Temizle"
                  data-tooltip="Tüm Çizimleri Temizle"
                  data-tooltip-pos={dockTooltipPos}
                  className={`${iconBtnBase} disabled:opacity-35 disabled:cursor-not-allowed text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50`}
                >
                  <Trash2 size={18} strokeWidth={2.2} />
                </button>

                {/* BÖLÜM 4B: Sınıf Araçları (Tahta Perdesi, Kura Çarkı, Ders Sayacı & Kronometre) */}
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setPaletteOpen(false);
                    toggleCurtain();
                  }}
                  aria-label="Tahta Perdesi"
                  aria-pressed={curtainOpen}
                  data-tooltip="Tahta Perdesi"
                  data-tooltip-pos={dockTooltipPos}
                  className={`${iconBtnBase} ${
                    curtainOpen
                      ? "bg-amber-500 text-slate-950 shadow-xs"
                      : "text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Blinds size={18} strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setPaletteOpen(false);
                    togglePicker();
                  }}
                  aria-label="Sınıf Kura Çarkı"
                  aria-pressed={pickerOpen}
                  data-tooltip="Sınıf Kura Çarkı"
                  data-tooltip-pos={dockTooltipPos}
                  className={`${iconBtnBase} ${
                    pickerOpen
                      ? "bg-[#6741D9] text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Dices size={18} strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setPaletteOpen(false);
                    toggleTimer();
                  }}
                  aria-label="Ders Sayacı ve Kronometre"
                  aria-pressed={timerOpen}
                  data-tooltip={
                    timerRunning
                      ? `Ders Sayacı (${formatTimerClock(timerSeconds)})`
                      : "Ders Sayacı ve Kronometre"
                  }
                  data-tooltip-pos={dockTooltipPos}
                  className={`relative ${iconBtnBase} ${
                    timerOpen || timerRunning
                      ? "bg-[#087F5B] text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Timer size={18} strokeWidth={2.2} />
                  {timerRunning && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-300"
                    />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
