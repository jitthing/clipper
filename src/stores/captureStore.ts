import { create } from "zustand";

interface CaptureState {
  mode: "idle" | "capturing" | "annotating" | "pinned";
  capturedImageUrl: string | null;
  setMode: (mode: CaptureState["mode"]) => void;
  setCapturedImage: (url: string | null) => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  mode: "idle",
  capturedImageUrl: null,
  setMode: (mode) => set({ mode }),
  setCapturedImage: (url) => set({ capturedImageUrl: url }),
}));
