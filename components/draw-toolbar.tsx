"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useDrawTool } from "@/lib/use-draw-tool";
import { useParcelData } from "@/lib/use-parcel-data";
import { useParcelSelection } from "@/lib/use-parcel-selection";

export function DrawToolbar() {
  const select = useParcelSelection((s) => s.select);
  const {
    active,
    editingParcel,
    vertices,
    drawnParcels,
    startDrawing,
    startEditing,
    cancelDrawing,
    removeLastVertex,
    finishPolygon,
    exportJSON,
    clearDrawnParcels,
  } = useDrawTool();
  const selectedId = useParcelSelection((s) => s.selectedId);
  const parcels = useParcelData();
  const selectedFeature = useMemo(
    () => selectedId ? parcels.features.find((f) => f.properties.id === selectedId) ?? null : null,
    [selectedId, parcels],
  );

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const resetForm = useCallback(() => {
    setShowForm(false);
    setName("");
  }, []);

  const openFinishForm = useCallback(() => {
    setName(editingParcel?.properties.name ?? "");
    setShowForm(true);
  }, [editingParcel]);

  // Keyboard shortcuts — only when drawing and form is not open
  useEffect(() => {
    if (!active || showForm) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && vertices.length >= 3) {
        e.preventDefault();
        openFinishForm();
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
  }, [active, showForm, vertices, openFinishForm, cancelDrawing, removeLastVertex]);

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

  async function handleSaveToProject() {
    if (drawnParcels.length === 0 || saveState === "saving") return;

    setSaveState("saving");
    setSaveMessage("");

    try {
      const response = await fetch("/api/parcels", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "FeatureCollection",
          features: drawnParcels,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not save parcels to project data.");
      }

      clearDrawnParcels();
      setSaveState("saved");
      setSaveMessage("Saved to project data. Opening viewer...");
      window.setTimeout(() => {
        window.location.assign("/viewer");
      }, 500);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error ? error.message : "Could not save parcels to project data.",
      );
    }
  }

  // State 3 — Form
  if (showForm) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[88px] z-20 flex justify-center px-4">
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto flex w-full max-w-[720px] flex-wrap items-center gap-2 rounded-[28px] border border-white/12 bg-[rgba(28,25,26,0.92)] p-[7px] text-sm text-white shadow-[0_18px_50px_rgba(4,16,28,0.24)] backdrop-blur-md"
        >
          <input
            type="text"
            placeholder="Parcel name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="min-w-[180px] flex-1 rounded-[20px] border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/38"
          />
          <button
            type="submit"
            className="rounded-[22px] bg-[rgba(255,255,255,0.14)] px-5 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[rgba(255,255,255,0.2)]"
          >
            {editingParcel ? "Update Parcel" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-[22px] px-5 py-3 text-[15px] font-semibold text-white/72 transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
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
      <div className="pointer-events-none fixed inset-x-0 top-[88px] z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-[760px] flex-wrap items-center gap-4 rounded-[28px] border border-white/12 bg-[rgba(28,25,26,0.92)] px-5 py-4 text-sm text-white shadow-[0_18px_50px_rgba(4,16,28,0.24)] backdrop-blur-md">
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-medium">
            Vertices: <span className="text-cyan-400">{vertices.length}</span>
          </span>
          {editingParcel && (
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-medium text-white/72">
              Editing {editingParcel.properties.id}
            </span>
          )}
          <span className="text-white/62">
            Click to place vertices. Enter to finish. Esc to cancel. Backspace to undo.
          </span>
          <button
            type="button"
            onClick={openFinishForm}
            disabled={vertices.length < 3}
            className="ml-auto rounded-[22px] bg-[rgba(255,255,255,0.14)] px-5 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {editingParcel ? "Finish Edit" : "Finish Parcel"}
          </button>
        </div>
      </div>
    );
  }

  // State 1 — Idle
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[88px] z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-[860px] flex-wrap items-center gap-2 rounded-[28px] border border-white/12 bg-[rgba(28,25,26,0.92)] p-[7px] text-sm text-white shadow-[0_18px_50px_rgba(4,16,28,0.24)] backdrop-blur-md">
        <button
          onClick={() => {
            select(null);
            startDrawing();
          }}
          className="rounded-[22px] bg-[rgba(255,255,255,0.14)] px-5 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[rgba(255,255,255,0.2)]"
        >
          New Parcel
        </button>
        {selectedFeature && (
          <button
            onClick={() => {
              select(null);
              startEditing(selectedFeature);
            }}
            className="rounded-[22px] px-5 py-3 text-[15px] font-semibold text-white/72 transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
          >
            Edit Parcel
          </button>
        )}
        <button
          onClick={exportJSON}
          className="rounded-[22px] px-5 py-3 text-[15px] font-semibold text-white/72 transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
        >
          Export JSON
        </button>
        <button
          onClick={handleSaveToProject}
          disabled={drawnParcels.length === 0 || saveState === "saving"}
          className="rounded-[22px] bg-[#194f41] px-5 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[#21604f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveState === "saving" ? "Saving..." : "Save To Project"}
        </button>
        {drawnParcels.length > 0 && (
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/76">
            {drawnParcels.length} drawn
          </span>
        )}
        {selectedFeature && (
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/76">
            Selected {selectedFeature.properties.id}
          </span>
        )}
        {saveMessage && (
          <span
            className={`px-2 text-xs ${
              saveState === "error" ? "text-red-300" : "text-white/70"
            }`}
          >
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
}
