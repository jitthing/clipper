const colors = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#000000",
];

interface ColorPickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  return (
    <div className="flex gap-1 p-2 bg-white rounded-lg shadow-lg">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          className={`w-6 h-6 rounded-full border-2 transition-transform ${
            selected === color ? "border-gray-800 scale-110" : "border-transparent"
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
