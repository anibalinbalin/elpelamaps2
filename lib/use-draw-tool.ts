import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ParcelProperties, ParcelFeature } from "./parcels";
import { getParcels } from "./parcels";
import { sphericalArea } from "./geo-area";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueId(name: string, existing: string[]): string {
  const base = slugify(name);
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

interface DrawToolState {
  active: boolean;
  vertices: [number, number][];
  drawnParcels: ParcelFeature[];
  startDrawing: () => void;
  addVertex: (lon: number, lat: number) => void;
  removeLastVertex: () => void;
  cancelDrawing: () => void;
  finishPolygon: (props: Omit<ParcelProperties, "id" | "areaSqMeters">) => void;
  exportJSON: () => void;
}

export const useDrawTool = create<DrawToolState>()(
  persist(
    (set, get) => ({
      active: false,
      vertices: [],
      drawnParcels: [],

      startDrawing: () => set({ active: true, vertices: [] }),

      addVertex: (lon, lat) =>
        set((s) => ({ vertices: [...s.vertices, [lon, lat]] })),

      removeLastVertex: () =>
        set((s) => ({ vertices: s.vertices.slice(0, -1) })),

      cancelDrawing: () => set({ active: false, vertices: [] }),

      finishPolygon: (props) => {
        const { vertices, drawnParcels } = get();
        if (vertices.length < 3) return;

        const ring: [number, number][] = [...vertices, vertices[0]];
        const allIds = [
          ...getParcels().features.map((f) => f.properties.id),
          ...drawnParcels.map((f) => f.properties.id),
        ];
        const id = uniqueId(props.name, allIds);
        const areaSqMeters = Math.round(sphericalArea(ring));

        const feature: ParcelFeature = {
          type: "Feature",
          properties: { ...props, id, areaSqMeters },
          geometry: { type: "Polygon", coordinates: [ring] },
        };

        set({
          active: false,
          vertices: [],
          drawnParcels: [...drawnParcels, feature],
        });
      },

      exportJSON: () => {
        const { drawnParcels } = get();
        const staticParcels = getParcels();
        const merged = {
          ...staticParcels,
          features: [...staticParcels.features, ...drawnParcels],
        };
        const blob = new Blob([JSON.stringify(merged, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "parcels.json";
        a.click();
        URL.revokeObjectURL(url);
      },
    }),
    {
      name: "elpela-draw-tool",
      partialize: (state) => ({ drawnParcels: state.drawnParcels }),
    }
  )
);
