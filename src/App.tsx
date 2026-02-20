import { useState } from "react";
import { CaptureOverlay } from "./components/CaptureOverlay";
import { Toolbar } from "./components/Toolbar";

function App() {
  const [mode, setMode] = useState<"idle" | "capturing" | "annotating">("idle");

  return (
    <div className="min-h-screen bg-transparent">
      {mode === "idle" && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8 rounded-2xl bg-white/90 shadow-xl backdrop-blur-sm">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">📸 Snaplark</h1>
            <p className="text-gray-500 mb-6">
              Press <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">⌘⇧X</kbd> to capture
            </p>
            <button
              onClick={() => setMode("capturing")}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Start Capture
            </button>
          </div>
        </div>
      )}

      {mode === "capturing" && (
        <CaptureOverlay onCapture={() => setMode("annotating")} onCancel={() => setMode("idle")} />
      )}

      {mode === "annotating" && (
        <div className="flex flex-col h-screen">
          <Toolbar />
          <div className="flex-1 flex items-center justify-center bg-gray-100">
            <p className="text-gray-400">Annotation canvas — coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
