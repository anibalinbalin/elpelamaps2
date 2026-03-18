"use client";

import { useParcelSelection } from "@/lib/use-parcel-selection";

export interface PillPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  visible: boolean;
}

interface ParcelPillsOverlayProps {
  positions: PillPosition[];
}

export function ParcelPillsOverlay({ positions }: ParcelPillsOverlayProps) {
  const selectedId = useParcelSelection((s) => s.selectedId);

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {positions.map((pill) =>
        pill.visible ? (
          <div key={pill.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pill.x, top: pill.y }}>
            <div className={`rounded-[10px] border px-2.5 py-0.5 text-[10px] backdrop-blur-sm transition-all duration-200 ${
              pill.id === selectedId
                ? "border-cyan-400/40 bg-cyan-950/70 text-cyan-300"
                : "border-white/8 bg-[rgba(30,30,30,0.7)] text-white/60"
            }`}>
              {pill.name}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
