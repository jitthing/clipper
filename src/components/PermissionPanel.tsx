interface PermissionPanelProps {
  screenRecordingGranted: boolean;
  accessibilityGranted: boolean;
  onRequestScreenRecording: () => void;
  onOpenScreenRecordingSettings: () => void;
  onRequestAccessibility: () => void;
  onOpenAccessibilitySettings: () => void;
  onRefresh: () => void;
}

export function PermissionPanel({
  screenRecordingGranted,
  accessibilityGranted,
  onRequestScreenRecording,
  onOpenScreenRecordingSettings,
  onRequestAccessibility,
  onOpenAccessibilitySettings,
  onRefresh,
}: PermissionPanelProps) {
  return (
    <div className="text-center p-6 rounded-xl bg-white/95 shadow-xl max-w-xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Permissions Required</h2>
      <p className="text-gray-600 mb-5">
        Clipper needs Screen Recording access to capture your screen. Accessibility is recommended
        for the best window selection metadata.
      </p>

      <div className="text-left text-sm space-y-2 mb-5">
        <p>
          Screen Recording:{" "}
          <span className={screenRecordingGranted ? "text-green-600" : "text-red-600"}>
            {screenRecordingGranted ? "Granted" : "Not granted"}
          </span>
        </p>
        <p>
          Accessibility:{" "}
          <span className={accessibilityGranted ? "text-green-600" : "text-amber-600"}>
            {accessibilityGranted ? "Granted" : "Not granted"}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {!screenRecordingGranted && (
          <>
            <button
              onClick={onRequestScreenRecording}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Request Screen Recording
            </button>
            <button
              onClick={onOpenScreenRecordingSettings}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Open Screen Settings
            </button>
          </>
        )}

        {!accessibilityGranted && (
          <>
            <button
              onClick={onRequestAccessibility}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Request Accessibility
            </button>
            <button
              onClick={onOpenAccessibilitySettings}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Open Accessibility Settings
            </button>
          </>
        )}

        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Refresh Status
        </button>
      </div>
    </div>
  );
}
