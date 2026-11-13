import { create } from "zustand";

export type SmartboardTool =
  | "navigate"
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "circle"
  | "square"
  | "rect"
  | "triangle"
  | "eraser";

export type IrabSemanticColorId =
  | "merfu"
  | "mansub"
  | "mecrur"
  | "haber"
  | "fiil";

export type PenWidthPreset = "thin" | "medium" | "thick";
export type DockReachZone = "bottom" | "right" | "left";
export type CurtainAxis = "vertical" | "horizontal";
export type GrammarSplitSide = "left" | "right";

const GRAMMAR_SPLIT_SIDE_KEY = "muallimun-grammar-split-side";

function readInitialGrammarSplitSide(): GrammarSplitSide {
  if (typeof window === "undefined") return "right";
  try {
    const saved = window.localStorage.getItem(GRAMMAR_SPLIT_SIDE_KEY);
    return saved === "left" ? "left" : "right";
  } catch {
    return "right";
  }
}

function persistGrammarSplitSide(side: GrammarSplitSide): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GRAMMAR_SPLIT_SIDE_KEY, side);
  } catch {
    // ignore
  }
}

interface ClassroomToolsState {
  isOpen: boolean;
  isCollapsed: boolean;
  activeTool: SmartboardTool;
  activeColorId: IrabSemanticColorId;
  activeColorHex: string;
  penWidth: PenWidthPreset;
  dockZone: DockReachZone;
  curtainOpen: boolean;
  curtainRatio: number;
  curtainAxis: CurtainAxis;
  pickerOpen: boolean;
  timerOpen: boolean;
  isGrammarSplitOpen: boolean;
  grammarSplitSide: GrammarSplitSide;
  isClassroomPresentationMode: boolean;

  openToolbar: (initialTool?: SmartboardTool) => void;
  closeToolbar: () => void;
  toggleToolbar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setActiveTool: (tool: SmartboardTool) => void;
  setActiveColorId: (colorId: IrabSemanticColorId) => void;
  setActiveColorHex: (hex: string) => void;
  setPenWidth: (width: PenWidthPreset) => void;
  setDockZone: (zone: DockReachZone) => void;
  toggleCurtain: () => void;
  setCurtainOpen: (open: boolean) => void;
  setCurtainRatio: (ratio: number) => void;
  setCurtainAxis: (axis: CurtainAxis) => void;
  setPickerOpen: (open: boolean) => void;
  togglePicker: () => void;
  setTimerOpen: (open: boolean) => void;
  toggleTimer: () => void;
  setGrammarSplitOpen: (open: boolean) => void;
  toggleGrammarSplit: () => void;
  setGrammarSplitSide: (side: GrammarSplitSide) => void;
  toggleGrammarSplitSide: () => void;
  setClassroomPresentationMode: (active: boolean) => void;
}

export const useClassroomToolsStore = create<ClassroomToolsState>((set) => ({
  isOpen: false,
  isCollapsed: false,
  activeTool: "navigate",
  activeColorId: "merfu",
  activeColorHex: "#EF4444",
  penWidth: "medium",
  dockZone: "bottom",
  curtainOpen: false,
  curtainRatio: 0.48,
  curtainAxis: "vertical",
  pickerOpen: false,
  timerOpen: false,
  isGrammarSplitOpen: false,
  grammarSplitSide: readInitialGrammarSplitSide(),
  isClassroomPresentationMode: false,

  openToolbar: (initialTool) =>
    set((state) => ({
      isOpen: true,
      isCollapsed: false,
      activeTool: initialTool ?? state.activeTool,
    })),
  closeToolbar: () =>
    set({
      isOpen: false,
      isCollapsed: false,
      activeTool: "navigate",
      curtainOpen: false,
    }),
  toggleToolbar: () =>
    set((state) =>
      state.isOpen
        ? {
            isOpen: false,
            isCollapsed: false,
            activeTool: "navigate",
            curtainOpen: false,
          }
        : {
            isOpen: true,
            isCollapsed: false,
          }
    ),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColorId: (colorId) => set({ activeColorId: colorId }),
  setActiveColorHex: (hex) => set({ activeColorHex: hex }),
  setPenWidth: (width) => set({ penWidth: width }),
  setDockZone: (zone) => set({ dockZone: zone }),
  toggleCurtain: () =>
    set((state) => ({ curtainOpen: !state.curtainOpen })),
  setCurtainOpen: (open) => set({ curtainOpen: open }),
  setCurtainRatio: (ratio) =>
    set({ curtainRatio: Math.min(0.92, Math.max(0.08, ratio)) }),
  setCurtainAxis: (axis) => set({ curtainAxis: axis }),
  setPickerOpen: (open) => set({ pickerOpen: open }),
  togglePicker: () =>
    set((state) => ({ pickerOpen: !state.pickerOpen })),
  setTimerOpen: (open) => set({ timerOpen: open }),
  toggleTimer: () =>
    set((state) => ({ timerOpen: !state.timerOpen })),
  setGrammarSplitOpen: (open) => set({ isGrammarSplitOpen: open }),
  toggleGrammarSplit: () =>
    set((state) => ({ isGrammarSplitOpen: !state.isGrammarSplitOpen })),
  setGrammarSplitSide: (side) => {
    persistGrammarSplitSide(side);
    set({ grammarSplitSide: side });
  },
  toggleGrammarSplitSide: () =>
    set((state) => {
      const next: GrammarSplitSide =
        state.grammarSplitSide === "left" ? "right" : "left";
      persistGrammarSplitSide(next);
      return { grammarSplitSide: next };
    }),
  setClassroomPresentationMode: (active) =>
    set({ isClassroomPresentationMode: active }),
}));
