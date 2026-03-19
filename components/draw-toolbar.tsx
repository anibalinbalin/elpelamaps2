"use client";

import { useEffect, useState, useCallback } from "react";
import { useDrawTool } from "@/lib/use-draw-tool";

const ZONING_OPTIONS = [
  "Residential",
  "Mixed Use",
  "Rural Residential",
  "Commercial",
];

const STATUS_OPTIONS: { label: string; value: "for-sale" | "sold" | "reserved" }[] = [
  { label: "For Sale", value: "for-sale" },
  { label: "Sold", value: "sold" },
  { label: "Reserved", value: "reserved" },
];

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

  // Form fields
  const [name, setName] = useState("");
  const [priceUSD, setPriceUSD] = useState<number>(0);
  const [zoning, setZoning] = useState(ZONING_OPTIONS[0]);
  const [status, setStatus] = useState<"for-sale" | "sold" | "reserved">("for-sale");
  const [description, setDescription] = useState("");
  const [contactUrl, setContactUrl] = useState("https://wa.me/");

  const resetForm = useCallback(() => {
    setShowForm(false);
    setName("");
    setPriceUSD(0);
    setZoning(ZONING_OPTIONS[0]);
    setStatus("for-sale");
    setDescription("");
    setContactUrl("https://wa.me/");
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

    finishPolygon({
      name: name.trim(),
      priceUSD,
      zoning,
      status,
      description: description.trim() || undefined,
      contactUrl: contactUrl.trim(),
    });
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
        <form onSubmit={handleSubmit} className="flex items-center gap-2 text-sm flex-wrap">
          <input
            type="text"
            placeholder="Name *"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/40 w-32"
          />
          <input
            type="number"
            placeholder="Price USD"
            value={priceUSD || ""}
            onChange={(e) => setPriceUSD(Number(e.target.value))}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/40 w-28"
          />
          <select
            value={zoning}
            onChange={(e) => setZoning(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white w-36"
          >
            {ZONING_OPTIONS.map((z) => (
              <option key={z} value={z} className="bg-black text-white">
                {z}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white w-28"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value} className="bg-black text-white">
                {s.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/40 w-32"
          />
          <input
            type="text"
            placeholder="Contact URL"
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/40 w-36"
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
