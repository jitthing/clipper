import { useState } from "react";

interface SaveDialogProps {
  onSave: (format: "png" | "jpg", quality: number) => void;
  onCancel: () => void;
}

export function SaveDialog({ onSave, onCancel }: SaveDialogProps) {
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const [quality, setQuality] = useState(92);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Save Screenshot</h2>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600 mb-2 block">Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat("png")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                format === "png"
                  ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              PNG
            </button>
            <button
              onClick={() => setFormat("jpg")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                format === "jpg"
                  ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              JPG
            </button>
          </div>
        </div>

        {format === "jpg" && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-600 mb-2 block">
              Quality: {quality}%
            </label>
            <input
              type="range"
              min={10}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(format, quality / 100)}
            className="flex-1 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
