const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff", "#000000"];

interface ColorPickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  return (
    <div className="flex gap-1 p-1">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={`h-5 w-5 rounded-full border ${
            c === "#ffffff" ? "border-gray-400" : "border-transparent"
          } ${selected === c ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900" : ""}`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
    </div>
  );
}
