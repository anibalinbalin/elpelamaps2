"use client";

import { useEffect, useState, useCallback } from "react";
import { useDrawTool } from "@/lib/use-draw-tool";

export function DrawToolbar() {
  const {
    active,
    vertices,
    drawnParcels,
    startDrawing,
    cancelDrawing,
    removeLastVertex,
    finishPolygon,
    exportJSON,
  } = useDrawTool();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");

  const resetForm = useCallback(() => {
    setShowForm(false);
    setName("");
  }, []);

  // Keyboard shortcuts — only when drawing and form is not open
  useEffect(() => {
    if (!active || showForm) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && vertices.length >= 3) {
        e.preventDefault();
        setShowForm(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelDrawing();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        removeLastVertex();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, showForm, vertices, cancelDrawing, removeLastVertex]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    finishPolygon({ name: name.trim() });
    resetForm();
  }

  function handleCancel() {
    cancelDrawing();
    resetForm();
  }

  // State 3 — Form
  if (showForm) {
    return (
      <div className="fixed top-12 left-0 right-0 z-20 bg-black/80 text-white backdrop-blur px-4 py-2">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 text-sm">
          <input
            type="text"
            placeholder="Parcel name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/40 w-40"
          />
          <button
            type="submit"
            className="bg-cyan-600 hover:bg-cyan-500 text-white rounded px-3 py-1 font-medium transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="bg-white/10 hover:bg-white/20 text-white rounded px-3 py-1 transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  // State 2 — Drawing
  if (active) {
    return (
      <div className="fixed top-12 left-0 right-0 z-20 bg-black/80 text-white backdrop-blur px-4 py-2">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">
            Vertices: <span className="text-cyan-400">{vertices.length}</span>
          </span>
          <span className="text-white/60">
            Click to place vertices. Enter to finish. Esc to cancel. Backspace to undo.
          </span>
        </div>
      </div>
    );
  }

  // State 1 — Idle
  return (
    <div className="fixed top-12 left-0 right-0 z-20 bg-black/80 text-white backdrop-blur px-4 py-2">
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={startDrawing}
          className="bg-cyan-600 hover:bg-cyan-500 text-white rounded px-3 py-1 font-medium transition-colors"
        >
          New Parcel
        </button>
        <button
          onClick={exportJSON}
          className="bg-white/10 hover:bg-white/20 text-white rounded px-3 py-1 transition-colors"
        >
          Export JSON
        </button>
        {drawnParcels.length > 0 && (
          <span className="bg-cyan-600/80 text-white text-xs rounded-full px-2 py-0.5 font-medium">
            {drawnParcels.length} drawn
          </span>
        )}
      </div>
    </div>
  );
}
