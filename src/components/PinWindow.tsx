import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * PinWindow renders inside a frameless always-on-top Tauri window.
 * It receives image data via window.__PIN_DATA__ (injected by the Rust backend).
 */
export function PinWindow() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [label, setLabel] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const loadData = () => {
      const data = (window as any).__PIN_DATA__;
      if (data) {
        setImageData(data.imageData);
        setLabel(data.label);
      }
    };

    // Try immediately (data may already be set)
    loadData();
    // Also listen for the event
    window.addEventListener("pin-data-ready", loadData);
    return () => window.removeEventListener("pin-data-ready", loadData);
  }, []);

  const handleClose = async () => {
    try {
      await invoke("close_pin_window", { label });
    } catch {
      // Window may already be closing
    }
  };

  if (!imageData) {
    return null; // Not a pin window, or data not yet received
  }

  return (
    <div
      className="relative group w-full h-full cursor-grab select-none"
      data-tauri-drag-region
      style={{ WebkitUserSelect: "none" }}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
    >
      <img
        src={`data:image/png;base64,${imageData}`}
        alt="Pinned screenshot"
        className="w-full h-full object-contain"
        draggable={false}
        style={{ pointerEvents: isDragging ? "none" : "auto" }}
      />
      <button
        onClick={handleClose}
        className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
        title="Close pin"
      >
        ✕
      </button>
    </div>
  );
}
