interface ToastProps {
  message: string;
  variant?: "success" | "error";
}

export function Toast({ message, variant = "success" }: ToastProps) {
  const colorClasses =
    variant === "error"
      ? "bg-red-900/90 border-red-500/35 text-red-100"
      : "bg-black/85 border-white/15 text-white";

  return (
    <div
      className={`pointer-events-none fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-full border px-4 py-2 text-xs font-medium shadow-xl backdrop-blur-sm ${colorClasses}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
