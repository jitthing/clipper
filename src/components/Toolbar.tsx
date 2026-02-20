import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

const tools = [
  { id: "arrow", icon: "↗", label: "Arrow" },
  { id: "rectangle", icon: "□", label: "Rectangle" },
  { id: "circle", icon: "○", label: "Circle" },
  { id: "line", icon: "─", label: "Line" },
  { id: "text", icon: "T", label: "Text" },
  { id: "blur", icon: "▦", label: "Blur" },
  { id: "number", icon: "#", label: "Number" },
] as const;

interface ToolbarProps {
  onCopy?: () => Promise<string | null>;
  onPin?: () => Promise<{ imageData: string; width: number; height: number } | null>;
  onSave?: () => void;
}

export function Toolbar({ onCopy, onPin, onSave }: ToolbarProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string>("arrow");

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      const imageData = onCopy ? await onCopy() : null;
      if (imageData) {
        await invoke("copy_to_clipboard", { imageData });
        showToast("Copied!");
      }
    } catch (err) {
      console.error("Copy failed:", err);
      showToast("Copy failed");
    }
  }, [onCopy, showToast]);

  const handlePin = useCallback(async () => {
    try {
      const data = onPin ? await onPin() : null;
      if (data) {
        await invoke("pin_screenshot", {
          imageData: data.imageData,
          width: data.width,
          height: data.height,
        });
        showToast("Pinned!");
      }
    } catch (err) {
      console.error("Pin failed:", err);
      showToast("Pin failed");
    }
  }, [onPin, showToast]);

  // Cmd+C shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "c") {
        e.preventDefault();
        handleCopy();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCopy]);

  return (
    <div className="relative flex items-center gap-1 p-2 bg-white border-b shadow-sm">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors text-lg ${
            activeTool === tool.id
              ? "bg-blue-100 text-blue-600"
              : "hover:bg-gray-100"
          }`}
          title={tool.label}
          onClick={() => setActiveTool(tool.id)}
        >
          {tool.icon}
        </button>
      ))}
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow cursor-pointer" title="Color" />
      <div className="flex-1" />
      <button
        onClick={handleCopy}
        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        title="Copy to clipboard (⌘C)"
      >
        📋 Copy
      </button>
      <button
        onClick={onSave}
        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
      >
        💾 Save
      </button>
      <button
        onClick={handlePin}
        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        title="Pin to screen"
      >
        📌 Pin
      </button>

      {/* Toast notification */}
      {toast && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-2 bg-black/80 text-white text-sm rounded-lg shadow-lg animate-fade-in z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
