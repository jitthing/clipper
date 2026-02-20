import { useState } from "react";
import { useCaptureStore, type AnnotationTool, type BlurSize } from "../stores/captureStore";
import { ColorPicker } from "./ColorPicker";

const tools: { id: AnnotationTool; icon: string; label: string }[] = [
  { id: "arrow", icon: "↗", label: "Arrow" },
  { id: "rectangle", icon: "□", label: "Rectangle" },
  { id: "circle", icon: "○", label: "Circle" },
  { id: "line", icon: "─", label: "Line" },
  { id: "text", icon: "T", label: "Text" },
  { id: "blur", icon: "▦", label: "Blur/Mosaic" },
  { id: "number", icon: "#", label: "Number" },
];

const strokeWidths = [2, 4, 6] as const;
const blurSizes: { value: BlurSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

interface ToolbarProps {
  onCopy: () => void;
  onSave: () => void;
  onPin?: () => void;
}

export function Toolbar({ onCopy, onSave, onPin }: ToolbarProps) {
  const {
    activeTool, setActiveTool,
    color, setColor,
    strokeWidth, setStrokeWidth,
    fontSize, setFontSize,
    blurSize, setBlurSize,
    undo, redo,
    annotations, undoneAnnotations,
  } = useCaptureStore();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokeMenu, setShowStrokeMenu] = useState(false);

  return (
    <div className="flex items-center gap-1 p-2 bg-white border-b shadow-sm select-none relative">
      {/* Tool buttons */}
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors text-lg ${
            activeTool === tool.id
              ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
              : "hover:bg-gray-100 text-gray-700"
          }`}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Color picker */}
      <div className="relative">
        <button
          onClick={() => { setShowColorPicker(!showColorPicker); setShowStrokeMenu(false); }}
          className="w-8 h-8 rounded-full border-2 border-white shadow cursor-pointer hover:scale-110 transition-transform"
          style={{ backgroundColor: color }}
          title="Color"
        />
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-2 z-20">
            <ColorPicker
              selected={color}
              onSelect={(c) => { setColor(c); setShowColorPicker(false); }}
            />
          </div>
        )}
      </div>

      {/* Stroke width */}
      <div className="relative">
        <button
          onClick={() => { setShowStrokeMenu(!showStrokeMenu); setShowColorPicker(false); }}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-sm font-mono"
          title={`Stroke: ${strokeWidth}px`}
        >
          <div
            className="rounded-full bg-current"
            style={{ width: strokeWidth * 2 + 4, height: strokeWidth * 2 + 4 }}
          />
        </button>
        {showStrokeMenu && (
          <div className="absolute top-full left-0 mt-2 z-20 bg-white rounded-lg shadow-lg p-2 flex gap-1">
            {strokeWidths.map((w) => (
              <button
                key={w}
                onClick={() => { setStrokeWidth(w); setShowStrokeMenu(false); }}
                className={`w-8 h-8 flex items-center justify-center rounded ${
                  strokeWidth === w ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                <div
                  className="rounded-full bg-gray-800"
                  style={{ width: w * 2 + 2, height: w * 2 + 2 }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Blur size (only when blur tool active) */}
      {activeTool === "blur" && (
        <div className="flex items-center gap-0.5 ml-1">
          {blurSizes.map((bs) => (
            <button
              key={bs.value}
              onClick={() => setBlurSize(bs.value)}
              className={`w-8 h-8 text-xs font-bold rounded ${
                blurSize === bs.value
                  ? "bg-blue-100 text-blue-600"
                  : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {bs.label}
            </button>
          ))}
        </div>
      )}

      {/* Font size (only when text tool active) */}
      {activeTool === "text" && (
        <select
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="ml-1 px-2 py-1 text-sm border rounded"
        >
          {[12, 14, 16, 20, 24, 32, 48].map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      )}

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Undo/Redo */}
      <button
        onClick={undo}
        disabled={annotations.length === 0}
        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        ↩
      </button>
      <button
        onClick={redo}
        disabled={undoneAnnotations.length === 0}
        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪
      </button>

      <div className="flex-1" />

      {/* Actions */}
      <button
        onClick={onCopy}
        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        📋 Copy
      </button>
      <button
        onClick={onSave}
        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
      >
        💾 Save
      </button>
      {onPin && (
        <button
          onClick={onPin}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          📌 Pin
        </button>
      )}
    </div>
  );
}
