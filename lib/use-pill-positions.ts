import { create } from "zustand";
import type { PillPosition } from "@/components/parcel-pills";

interface PillPositionsState {
  positions: PillPosition[];
  selectedPos: { x: number; y: number } | null;
  update: (positions: PillPosition[], selectedPos: { x: number; y: number } | null) => void;
}

export const usePillPositions = create<PillPositionsState>((set) => ({
  positions: [],
  selectedPos: null,
  update: (positions, selectedPos) => set({ positions, selectedPos }),
}));
