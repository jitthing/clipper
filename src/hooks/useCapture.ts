import { useState } from "react";
// import { invoke } from "@tauri-apps/api/core";

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCapture = async () => {
    setIsCapturing(true);
    // TODO: invoke("start_capture") via Tauri IPC
  };

  const captureRegion = async (_region: CaptureRegion) => {
    // TODO: invoke("capture_region", { region }) via Tauri IPC
    setIsCapturing(false);
  };

  const copyToClipboard = async () => {
    // TODO: invoke("copy_to_clipboard", { image: capturedImage })
  };

  const saveToFile = async (_format: "png" | "jpg") => {
    // TODO: invoke("save_to_file", { image: capturedImage, format })
  };

  return {
    isCapturing,
    capturedImage,
    startCapture,
    captureRegion,
    copyToClipboard,
    saveToFile,
    setCapturedImage,
  };
}
