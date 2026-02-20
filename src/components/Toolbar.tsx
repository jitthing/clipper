const tools = [
  { id: "arrow", icon: "↗", label: "Arrow" },
  { id: "rectangle", icon: "□", label: "Rectangle" },
  { id: "circle", icon: "○", label: "Circle" },
  { id: "line", icon: "─", label: "Line" },
  { id: "text", icon: "T", label: "Text" },
  { id: "blur", icon: "▦", label: "Blur" },
  { id: "number", icon: "#", label: "Number" },
] as const;

export function Toolbar() {
  return (
    <div className="flex items-center gap-1 p-2 bg-white border-b shadow-sm">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg"
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow cursor-pointer" title="Color" />
      <div className="flex-1" />
      <button className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">
        Copy
      </button>
      <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
        Save
      </button>
      <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
        Pin
      </button>
    </div>
  );
}
