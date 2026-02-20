import { create } from "zustand";

export type AnnotationTool =
  | "arrow"
  | "rectangle"
  | "circle"
  | "line"
  | "text"
  | "blur"
  | "number";

export type BlurSize = "small" | "medium" | "large";

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  tool: AnnotationTool;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  number?: number;
  blurSize?: BlurSize;
}

interface CaptureState {
  // App mode
  mode: "idle" | "capturing" | "annotating" | "pinned";
  setMode: (mode: CaptureState["mode"]) => void;

  // Captured image
  capturedImageUrl: string | null;
  setCapturedImage: (url: string | null) => void;
  capturedRegion: { x: number; y: number; width: number; height: number } | null;
  setCapturedRegion: (r: CaptureState["capturedRegion"]) => void;

  // Tool state
  activeTool: AnnotationTool;
  setActiveTool: (tool: AnnotationTool) => void;
  color: string;
  setColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  blurSize: BlurSize;
  setBlurSize: (s: BlurSize) => void;

  // Annotations + history
  annotations: Annotation[];
  undoneAnnotations: Annotation[];
  nextNumber: number;
  addAnnotation: (a: Annotation) => void;
  undo: () => void;
  redo: () => void;
  clearAnnotations: () => void;

  // Save dialog
  showSaveDialog: boolean;
  setShowSaveDialog: (v: boolean) => void;
}

let _id = 0;
export const genId = () => `ann_${++_id}_${Date.now()}`;

export const useCaptureStore = create<CaptureState>((set) => ({
  mode: "idle",
  setMode: (mode) => set({ mode }),

  capturedImageUrl: null,
  setCapturedImage: (url) => set({ capturedImageUrl: url }),
  capturedRegion: null,
  setCapturedRegion: (r) => set({ capturedRegion: r }),

  activeTool: "arrow",
  setActiveTool: (tool) => set({ activeTool: tool }),
  color: "#ef4444",
  setColor: (color) => set({ color }),
  strokeWidth: 2,
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  fontSize: 16,
  setFontSize: (fontSize) => set({ fontSize }),
  blurSize: "medium",
  setBlurSize: (blurSize) => set({ blurSize }),

  annotations: [],
  undoneAnnotations: [],
  nextNumber: 1,

  addAnnotation: (a) =>
    set((s) => ({
      annotations: [...s.annotations, a],
      undoneAnnotations: [],
      nextNumber: a.tool === "number" ? s.nextNumber + 1 : s.nextNumber,
    })),

  undo: () =>
    set((s) => {
      if (s.annotations.length === 0) return s;
      const last = s.annotations[s.annotations.length - 1];
      return {
        annotations: s.annotations.slice(0, -1),
        undoneAnnotations: [...s.undoneAnnotations, last],
        nextNumber: last.tool === "number" ? s.nextNumber - 1 : s.nextNumber,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.undoneAnnotations.length === 0) return s;
      const last = s.undoneAnnotations[s.undoneAnnotations.length - 1];
      return {
        annotations: [...s.annotations, last],
        undoneAnnotations: s.undoneAnnotations.slice(0, -1),
        nextNumber: last.tool === "number" ? s.nextNumber + 1 : s.nextNumber,
      };
    }),

  clearAnnotations: () => set({ annotations: [], undoneAnnotations: [], nextNumber: 1 }),

  showSaveDialog: false,
  setShowSaveDialog: (v) => set({ showSaveDialog: v }),
}));
