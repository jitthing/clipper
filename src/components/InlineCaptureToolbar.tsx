import React, { useState } from 'react';
import { useCaptureStore, AnnotationTool } from '../stores/captureStore';
import { ColorPicker } from './ColorPicker';

const IconRectangle = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="12" height="12" rx="1"/></svg>;
const IconCircle = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6"/></svg>;
const IconArrow = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12L12 4M12 4H6M12 4V10"/></svg>;
const IconLine = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 13L13 3"/></svg>;
const IconPen = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l-8 8v4h4l8-8-4-4z"/></svg>;
const IconText = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h8M8 4v8"/></svg>;
const IconBlur = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2c-3 4-5 6-5 9a5 5 0 0010 0c0-3-2-5-5-9z"/></svg>;
const IconNumber = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M6 6l2-1"/></svg>;

interface InlineCaptureToolbarProps {
  region: { x: number; y: number; width: number; height: number };
  onConfirm: () => void;
  onCancel: () => void;
  onSave: () => void;
  onCopy: () => void;
  screenshotData: string;
}

export function InlineCaptureToolbar({
  region,
  onConfirm,
  onCancel,
  onSave,
  onCopy,
}: InlineCaptureToolbarProps) {
  const { activeTool, setActiveTool, undo, redo, annotations, undoneAnnotations, color, setColor } = useCaptureStore();
  const [showColorPicker, setShowColorPicker] = useState(false);

  const toolbarHeight = 44;
  const margin = 8;
  const isEnoughSpaceBelow = region.y + region.height + margin + toolbarHeight < window.innerHeight;
  const top = isEnoughSpaceBelow
    ? region.y + region.height + margin
    : region.y - margin - toolbarHeight;

  const left = Math.max(margin, Math.min(region.x, window.innerWidth - 600));

  const tools: { id: AnnotationTool; icon: React.ReactNode; title: string }[] = [
    { id: 'rectangle', icon: <IconRectangle />, title: 'Rectangle' },
    { id: 'circle', icon: <IconCircle />, title: 'Circle' },
    { id: 'arrow', icon: <IconArrow />, title: 'Arrow' },
    { id: 'line', icon: <IconLine />, title: 'Line' },
    { id: 'pen', icon: <IconPen />, title: 'Pen' },
    { id: 'text', icon: <IconText />, title: 'Text' },
    { id: 'blur', icon: <IconBlur />, title: 'Blur/Mosaic' },
    { id: 'number', icon: <IconNumber />, title: 'Number stamp' },
  ];

  return (
    <div
      className="absolute flex items-center gap-0.5 bg-gray-900/90 backdrop-blur text-white px-2 py-1.5 rounded-full shadow-lg z-[100] select-none"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {tools.map((t) => (
        <button
          key={t.id}
          title={t.title}
          onClick={() => setActiveTool(t.id)}
          className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors ${
            activeTool === t.id ? 'bg-blue-500 text-white' : ''
          }`}
        >
          {t.icon}
        </button>
      ))}

      <div className="w-px h-5 bg-white/20 mx-1" />

      {/* Color picker */}
      <div className="relative flex items-center justify-center mx-1">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-5 h-5 rounded-full cursor-pointer border border-white/50 hover:scale-110 transition-transform"
          style={{ backgroundColor: color }}
          title="Color"
        />
        {showColorPicker && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 rounded-lg shadow-xl border border-gray-700 p-1">
            <ColorPicker
              selected={color}
              onSelect={(c) => {
                setColor(c);
                setShowColorPicker(false);
              }}
            />
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-white/20 mx-1" />

      <button title="Scan Text (OCR)" className="px-2 py-1 text-xs font-medium hover:bg-white/20 rounded whitespace-nowrap">
        Scan Text
      </button>

      <div className="w-px h-5 bg-white/20 mx-1" />

      <button
        title="Undo (Ctrl+Z)"
        onClick={undo}
        disabled={annotations.length === 0}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v4h4M3 11C5 7 9 5 13 7"/></svg>
      </button>
      <button
        title="Redo (Ctrl+Shift+Z)"
        onClick={redo}
        disabled={undoneAnnotations.length === 0}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7v4H9M13 11C11 7 7 5 3 7"/></svg>
      </button>

      <div className="w-px h-5 bg-white/20 mx-1" />

      <button title="Save to file" onClick={onSave} className="px-2.5 py-1 text-xs font-medium hover:bg-white/20 rounded whitespace-nowrap">
        Save
      </button>
      <button title="Copy to clipboard" onClick={onCopy} className="px-2.5 py-1 text-xs font-medium hover:bg-white/20 rounded whitespace-nowrap">
        Copy
      </button>

      <div className="w-px h-5 bg-white/20 mx-1" />

      <button
        title="Cancel (ESC)"
        onClick={onCancel}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-red-400"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
      </button>
      <button
        title="Confirm (Enter)"
        onClick={onConfirm}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white ml-0.5"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8l3 3 5-5"/></svg>
      </button>
    </div>
  );
}
