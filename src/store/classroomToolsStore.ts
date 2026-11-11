import { create } from "zustand";

export type SmartboardTool =
  | "navigate"
  | "pen"
  | "highlighter"
  | "arrow"
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

interface ClassroomToolsState {
  isOpen: boolean;
  isCollapsed: boolean;
  activeTool: SmartboardTool;
  activeColorId: IrabSemanticColorId;
  penWidth: PenWidthPreset;
  dockZone: DockReachZone;
  curtainOpen: boolean;
  curtainRatio: number;
  curtainAxis: CurtainAxis;
  pickerOpen: boolean;
  timerOpen: boolean;

  openToolbar: (initialTool?: SmartboardTool) => void;
  closeToolbar: () => void;
  toggleToolbar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setActiveTool: (tool: SmartboardTool) => void;
  setActiveColorId: (colorId: IrabSemanticColorId) => void;
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
}

export const useClassroomToolsStore = create<ClassroomToolsState>((set) => ({
  isOpen: false,
  isCollapsed: false,
  activeTool: "navigate",
  activeColorId: "merfu",
  penWidth: "medium",
  dockZone: "bottom",
  curtainOpen: false,
  curtainRatio: 0.48,
  curtainAxis: "vertical",
  pickerOpen: false,
  timerOpen: false,

  openToolbar: (initialTool) =>
    set((state) => ({
      isOpen: true,
      isCollapsed: false,
      activeTool: initialTool ?? state.activeTool,
    })),
  closeToolbar: () =>
    set({
      isOpen: false,
      activeTool: "navigate",
      curtainOpen: false,
      pickerOpen: false,
      timerOpen: false,
    }),
  toggleToolbar: () =>
    set((state) =>
      state.isOpen
        ? {
            isOpen: false,
            activeTool: "navigate",
            curtainOpen: false,
            pickerOpen: false,
            timerOpen: false,
          }
        : {
            isOpen: true,
            isCollapsed: false,
          }
    ),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColorId: (colorId) => set({ activeColorId: colorId }),
  setPenWidth: (width) => set({ penWidth: width }),
  setDockZone: (zone) => set({ dockZone: zone }),
  toggleCurtain: () =>
    set((state) => ({ isOpen: true, curtainOpen: !state.curtainOpen })),
  setCurtainOpen: (open) => set({ curtainOpen: open }),
  setCurtainRatio: (ratio) =>
    set({ curtainRatio: Math.min(0.92, Math.max(0.08, ratio)) }),
  setCurtainAxis: (axis) => set({ curtainAxis: axis }),
  setPickerOpen: (open) => set({ pickerOpen: open }),
  togglePicker: () =>
    set((state) => ({ isOpen: true, pickerOpen: !state.pickerOpen })),
  setTimerOpen: (open) => set({ timerOpen: open }),
  toggleTimer: () =>
    set((state) => ({ isOpen: true, timerOpen: !state.timerOpen })),
}));
