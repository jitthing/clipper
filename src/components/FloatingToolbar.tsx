import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useCaptureStore, type AnnotationTool, type BlurSize } from "../stores/captureStore";

const tools: { id: AnnotationTool; icon: string; label: string }[] = [
  { id: "arrow", icon: "↗", label: "Arrow" },
  { id: "rectangle", icon: "▭", label: "Rectangle" },
  { id: "circle", icon: "◯", label: "Circle" },
  { id: "line", icon: "／", label: "Line" },
  { id: "pen", icon: "✎", label: "Pen" },
  { id: "text", icon: "T", label: "Text" },
  { id: "blur", icon: "▦", label: "Blur" },
  { id: "number", icon: "#", label: "Number" },
];

const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff"];
const strokeWidths = [2, 4, 6, 8] as const;
const blurSizes: { value: BlurSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];
const fontSizes = [12, 14, 16, 20, 24, 32, 48];

interface FloatingToolbarProps {
  onCopy: () => Promise<void> | void;
  onSave: () => void;
  onPin?: () => Promise<void> | void;
  onCloseWindow: () => Promise<void> | void;
}

export function FloatingToolbar({ onCopy, onSave, onPin, onCloseWindow }: FloatingToolbarProps) {
  const {
    activeTool,
    setActiveTool,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
    fontSize,
    setFontSize,
    blurSize,
    setBlurSize,
    undo,
    redo,
    annotations,
    undoneAnnotations,
    setMode,
  } = useCaptureStore();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokeMenu, setShowStrokeMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const toolbarStyle = useMemo<CSSProperties>(() => {
    if (!position) {
      return {
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
      };
    }
    return {
      left: position.x,
      top: position.y,
    };
  }, [position]);

  const dismissPopovers = useCallback(() => {
    setShowColorPicker(false);
    setShowStrokeMenu(false);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1500);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await onCopy();
      showToast("Copied");
    } catch (err) {
      console.error("Copy failed:", err);
      showToast("Copy failed");
    }
  }, [onCopy, showToast]);

  const handlePin = useCallback(async () => {
    if (!onPin) return;
    try {
      await onPin();
      showToast("Pinned");
    } catch (err) {
      console.error("Pin failed:", err);
      showToast("Pin failed");
    }
  }, [onPin, showToast]);

  const handleClose = useCallback(async () => {
    setMode("idle");
    await onCloseWindow();
  }, [setMode, onCloseWindow]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCopy]);

  // Dismiss popovers when clicking outside the toolbar
  useEffect(() => {
    if (!showColorPicker && !showStrokeMenu) return;
    const handler = () => dismissPopovers();
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColorPicker, showStrokeMenu, dismissPopovers]);

  useEffect(() => {
    if (!dragOffset) return;

    const onMove = (e: PointerEvent) => {
      const nextX = e.clientX - dragOffset.x;
      const nextY = e.clientY - dragOffset.y;
      const toolbarW = toolbarRef.current ? toolbarRef.current.offsetWidth : 0;
      const toolbarH = toolbarRef.current ? toolbarRef.current.offsetHeight : 0;
      const maxX = window.innerWidth - toolbarW - 8;
      const maxY = window.innerHeight - toolbarH - 8;
      setPosition({
        x: Math.max(8, Math.min(maxX, nextX)),
        y: Math.max(8, Math.min(maxY, nextY)),
      });
    };

    const onUp = () => {
      setDragOffset(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragOffset]);

  return (
    <div
      className="fixed z-40 select-none"
      style={toolbarStyle}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {toast && (
        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-black/80 px-3 py-1.5 text-xs text-white shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div ref={toolbarRef} className="relative flex h-12 items-center gap-1 rounded-2xl border border-white/10 bg-gray-900/90 px-2 text-white shadow-2xl backdrop-blur-lg">
        <button
          onPointerDown={(e) => {
            const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
            setPosition((prev) => prev ?? { x: rect.left, y: rect.top });
            setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          className="flex h-8 w-6 cursor-grab items-center justify-center rounded-lg text-xs text-white/60 hover:bg-white/10 hover:text-white"
          title="Drag toolbar"
        >
          ⋮⋮
        </button>

        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id);
              dismissPopovers();
            }}
            className={`h-8 w-8 rounded-lg text-sm transition-colors ${
              activeTool === tool.id
                ? "bg-white/20 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-white/15" />

        <div className="relative">
          <button
            onClick={() => {
              setShowColorPicker((v) => !v);
              setShowStrokeMenu(false);
            }}
            className="h-8 w-8 rounded-full border border-white/30"
            style={{ backgroundColor: color }}
            title="Color"
          />
          {showColorPicker && (
            <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-xl border border-white/10 bg-gray-900/95 p-2 shadow-xl">
              <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-gray-900/95" />
              <div className="flex gap-1">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      setShowColorPicker(false);
                    }}
                    className={`h-6 w-6 rounded-full border ${c === "#ffffff" ? "border-white/40" : "border-transparent"} ${
                      color === c ? "ring-2 ring-blue-300" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowStrokeMenu((v) => !v);
              setShowColorPicker(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            title={`Stroke ${strokeWidth}px`}
          >
            <span
              className="block rounded-full bg-white"
              style={{ width: strokeWidth + 4, height: strokeWidth + 4 }}
            />
          </button>
          {showStrokeMenu && (
            <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-xl border border-white/10 bg-gray-900/95 p-1.5 shadow-xl">
              <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-gray-900/95" />
              <div className="flex gap-1">
                {strokeWidths.map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      setStrokeWidth(w);
                      setShowStrokeMenu(false);
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      strokeWidth === w ? "bg-white/20" : "text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <span className="block rounded-full bg-white" style={{ width: w + 4, height: w + 4 }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeTool === "blur" && (
          <div className="ml-0.5 flex items-center gap-1">
            {blurSizes.map((bs) => (
              <button
                key={bs.value}
                onClick={() => setBlurSize(bs.value)}
                className={`h-7 w-7 rounded-lg text-xs ${
                  blurSize === bs.value
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
                title={`Blur ${bs.label}`}
              >
                {bs.label}
              </button>
            ))}
          </div>
        )}

        {activeTool === "text" && (
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="h-8 rounded-lg border border-white/10 bg-white/10 px-2 text-xs text-white outline-none"
            title="Font size"
          >
            {fontSizes.map((s) => (
              <option key={s} value={s} className="text-black">
                {s}px
              </option>
            ))}
          </select>
        )}

        <div className="mx-1 h-6 w-px bg-white/15" />

        <button
          onClick={undo}
          disabled={annotations.length === 0}
          className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          title="Undo"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={undoneAnnotations.length === 0}
          className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          title="Redo"
        >
          ↷
        </button>

        <div className="mx-1 h-6 w-px bg-white/15" />

        <button
          onClick={handleCopy}
          className="h-8 rounded-lg px-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          title="Copy"
        >
          ⧉
        </button>
        <button
          onClick={onSave}
          className="h-8 rounded-lg px-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          title="Save"
        >
          ↓
        </button>
        {onPin && (
          <button
            onClick={handlePin}
            className="h-8 rounded-lg px-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
            title="Pin"
          >
            ⌂
          </button>
        )}
        <button
          onClick={handleClose}
          className="h-8 w-8 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          title="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
