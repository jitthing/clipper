import React from 'react';

interface Region { 
  x: number; 
  y: number; 
  width: number; 
  height: number; 
}

interface SelectionHandlesProps {
  region: Region;
  onMouseDownHandle: (e: React.MouseEvent, handle: string) => void;
}

export function SelectionHandles({ region, onMouseDownHandle }: SelectionHandlesProps) {
  const handles = [
    { id: 'nw', top: region.y, left: region.x, cursor: 'nwse-resize' },
    { id: 'n', top: region.y, left: region.x + region.width / 2, cursor: 'ns-resize' },
    { id: 'ne', top: region.y, left: region.x + region.width, cursor: 'nesw-resize' },
    { id: 'e', top: region.y + region.height / 2, left: region.x + region.width, cursor: 'ew-resize' },
    { id: 'se', top: region.y + region.height, left: region.x + region.width, cursor: 'nwse-resize' },
    { id: 's', top: region.y + region.height, left: region.x + region.width / 2, cursor: 'ns-resize' },
    { id: 'sw', top: region.y + region.height, left: region.x, cursor: 'nesw-resize' },
    { id: 'w', top: region.y + region.height / 2, left: region.x, cursor: 'ew-resize' },
  ];

  return (
    <>
      {handles.map((h) => (
        <div
          key={h.id}
          className="absolute w-2 h-2 bg-white border border-blue-500 rounded-full"
          style={{
            top: h.top,
            left: h.left,
            transform: 'translate(-50%, -50%)',
            cursor: h.cursor,
            zIndex: 50,
          }}
          onMouseDown={(e) => onMouseDownHandle(e, h.id)}
        />
      ))}
    </>
  );
}
