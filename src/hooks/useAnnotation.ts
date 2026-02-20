import { useState } from "react";

export type AnnotationTool = "arrow" | "rectangle" | "circle" | "line" | "text" | "blur" | "number";

export interface Annotation {
  id: string;
  tool: AnnotationTool;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  text?: string;
}

export function useAnnotation() {
  const [activeTool, setActiveTool] = useState<AnnotationTool>("arrow");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(2);

  const addAnnotation = (annotation: Annotation) => {
    setAnnotations((prev) => [...prev, annotation]);
  };

  const undo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const clear = () => {
    setAnnotations([]);
  };

  return {
    activeTool,
    setActiveTool,
    annotations,
    addAnnotation,
    undo,
    clear,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
  };
}
