interface PinWindowProps {
  imageUrl: string;
  onClose: () => void;
}

export function PinWindow({ imageUrl, onClose }: PinWindowProps) {
  return (
    <div className="relative group">
      <img src={imageUrl} alt="Pinned screenshot" className="rounded-lg shadow-2xl" />
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}
