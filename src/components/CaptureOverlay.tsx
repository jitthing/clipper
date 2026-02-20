interface CaptureOverlayProps {
  onCapture: () => void;
  onCancel: () => void;
}

export function CaptureOverlay({ onCapture, onCancel }: CaptureOverlayProps) {
  return (
    <div
      className="fixed inset-0 bg-black/30 cursor-crosshair z-50"
      onClick={onCapture}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      tabIndex={0}
    >
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
        Click and drag to select region · <span className="opacity-70">ESC to cancel</span>
      </div>
    </div>
  );
}
