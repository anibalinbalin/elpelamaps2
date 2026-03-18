import { create } from "zustand";
import type { ParcelProperties } from "./parcels";

interface ParcelSelectionState {
  selectedId: string | null;
  hoveredId: string | null;
  selectedParcel: ParcelProperties | null;
  select: (parcel: ParcelProperties | null) => void;
  hover: (id: string | null) => void;
}

export const useParcelSelection = create<ParcelSelectionState>((set) => ({
  selectedId: null,
  hoveredId: null,
  selectedParcel: null,
  select: (parcel) =>
    set({
      selectedId: parcel?.id ?? null,
      selectedParcel: parcel ?? null,
    }),
  hover: (id) => set({ hoveredId: id }),
}));
