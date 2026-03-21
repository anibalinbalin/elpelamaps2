import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ParcelProperties, ParcelFeature } from "./parcels";
import { getParcels, mergeParcelCollections } from "./parcels";
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
  editingParcel: ParcelFeature | null;
  startDrawing: () => void;
  startEditing: (feature: ParcelFeature) => void;
  addVertex: (lon: number, lat: number) => void;
  moveVertex: (index: number, lon: number, lat: number) => void;
  removeLastVertex: () => void;
  cancelDrawing: () => void;
  finishPolygon: (props: Omit<ParcelProperties, "id" | "areaSqMeters">) => void;
  exportJSON: () => void;
  clearDrawnParcels: () => void;
}

export const useDrawTool = create<DrawToolState>()(
  persist(
    (set, get) => ({
      active: false,
      vertices: [],
      drawnParcels: [],
      editingParcel: null,

      startDrawing: () => set({ active: true, vertices: [], editingParcel: null }),

      startEditing: (feature) =>
        set({
          active: true,
          vertices: feature.geometry.coordinates[0].slice(0, -1) as [number, number][],
          editingParcel: feature,
        }),

      addVertex: (lon, lat) =>
        set((s) => ({ vertices: [...s.vertices, [lon, lat]] })),

      moveVertex: (index, lon, lat) =>
        set((s) => ({
          vertices: s.vertices.map((v, i) => (i === index ? [lon, lat] : v)),
        })),

      removeLastVertex: () =>
        set((s) => ({ vertices: s.vertices.slice(0, -1) })),

      cancelDrawing: () => set({ active: false, vertices: [], editingParcel: null }),

      finishPolygon: (props) => {
        const { editingParcel, vertices, drawnParcels } = get();
        if (vertices.length < 3) return;

        const ring: [number, number][] = [...vertices, vertices[0]];
        const areaSqMeters = Math.round(sphericalArea(ring));
        const existingIds = [
          ...getParcels().features.map((f) => f.properties.id),
          ...drawnParcels
            .filter((f) => f.properties.id !== editingParcel?.properties.id)
            .map((f) => f.properties.id),
        ];
        const id = editingParcel
          ? editingParcel.properties.id
          : uniqueId(props.name, existingIds);

        const feature: ParcelFeature = {
          type: "Feature",
          properties: {
            ...(editingParcel?.properties ?? {}),
            ...props,
            id,
            areaSqMeters,
          },
          geometry: { type: "Polygon", coordinates: [ring] },
        };

        set({
          active: false,
          vertices: [],
          editingParcel: null,
          drawnParcels: [
            ...drawnParcels.filter((f) => f.properties.id !== feature.properties.id),
            feature,
          ],
        });
      },

      exportJSON: () => {
        const { drawnParcels } = get();
        const merged = mergeParcelCollections(getParcels(), {
          type: "FeatureCollection",
          features: drawnParcels,
        });
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

      clearDrawnParcels: () => set({ drawnParcels: [], editingParcel: null }),
    }),
    {
      name: "elpela-draw-tool",
      partialize: (state) => ({ drawnParcels: state.drawnParcels }),
    }
  )
);
