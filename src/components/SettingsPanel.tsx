interface ShortcutStatus {
  variant: "success" | "error";
  message: string;
}

interface SettingsPanelProps {
  captureShortcut: string;
  pendingCaptureShortcut: string;
  isListeningForShortcut: boolean;
  shortcutStatus: ShortcutStatus | null;
  onClose: () => void;
  onPendingCaptureShortcutChange: (value: string) => void;
  onStartListening: () => void;
  onReset: () => void;
  formatShortcutForDisplay: (shortcut: string) => string;
}

export function SettingsPanel({
  captureShortcut,
  pendingCaptureShortcut,
  isListeningForShortcut,
  shortcutStatus,
  onClose,
  onPendingCaptureShortcutChange,
  onStartListening,
  onReset,
  formatShortcutForDisplay,
}: SettingsPanelProps) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-950/95 p-6 text-white shadow-2xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-wide">Preferences</h2>
            <p className="mt-1 text-sm text-white/60">
              Update the global capture shortcut used from the tray.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
            Capture Hotkey
          </p>
          <p className="mt-2 text-sm text-white/70">
            Current:{" "}
            <kbd className="rounded-lg bg-black/40 px-2 py-1 font-mono text-xs text-white/90">
              {formatShortcutForDisplay(captureShortcut)}
            </kbd>
          </p>

          <label className="mt-4 block text-sm text-white/70" htmlFor="capture-shortcut">
            New shortcut
          </label>
          <input
            id="capture-shortcut"
            value={pendingCaptureShortcut}
            onChange={(event) => onPendingCaptureShortcutChange(event.target.value)}
            placeholder="CommandOrControl+Shift+X"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-blue-400/60"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={onStartListening}
              className="rounded-xl bg-blue-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
            >
              {isListeningForShortcut ? "Press keys..." : "Record Shortcut"}
            </button>
            <button
              onClick={onReset}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Reset to Default
            </button>
          </div>

          {shortcutStatus && (
            <p
              className={`mt-3 text-sm ${
                shortcutStatus.variant === "success" ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {shortcutStatus.message}
            </p>
          )}

          <p className="mt-3 text-xs leading-5 text-white/45">
            Requires Command/Ctrl plus Shift or Alt, followed by A-Z.{" "}
            {formatShortcutForDisplay("CommandOrControl+Shift+R")} is reserved for recording.
          </p>
        </div>
      </div>
    </div>
  );
}
