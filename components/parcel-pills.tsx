"use client";

import { useParcelSelection } from "@/lib/use-parcel-selection";
import { useDrawTool } from "@/lib/use-draw-tool";

export interface PillPosition {
  id: string;
  kicker: string;
  value: string;
  meta?: string;
  x: number;
  y: number;
  visible: boolean;
}

interface ParcelPillsOverlayProps {
  positions: PillPosition[];
}

export function ParcelPillsOverlay({ positions }: ParcelPillsOverlayProps) {
  const selectedId = useParcelSelection((s) => s.selectedId);
  const drawActive = useDrawTool((s) => s.active);

  if (drawActive) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {positions.map((pill) =>
        pill.visible ? (
          <div
            key={pill.id}
            className="absolute"
            style={{
              left: pill.x,
              top: pill.y,
              transform: "translate(-50%, calc(-100% - 18px))",
            }}
          >
            <ParcelMarker pill={pill} selected={pill.id === selectedId} />
          </div>
        ) : null
      )}
    </div>
  );
}

function ParcelMarker({
  pill,
  selected,
}: {
  pill: PillPosition;
  selected: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center">
      <div
        className={`absolute top-full h-8 w-8 rounded-full blur-xl transition-all duration-300 ${
          selected ? "bg-cyan-300/26" : "bg-emerald-300/14"
        }`}
      />
      <div
        className={`relative overflow-hidden rounded-[22px] border shadow-[0_18px_45px_rgba(5,17,28,0.28)] backdrop-blur-md transition-all duration-300 ${
          selected
            ? "border-cyan-200/26 bg-[rgba(18,38,49,0.76)] text-white"
            : "border-white/10 bg-[rgba(25,28,31,0.72)] text-white/88"
        }`}
      >
        <div
          className={`absolute inset-0 ${
            selected
              ? "bg-[linear-gradient(180deg,rgba(158,241,255,0.12),rgba(158,241,255,0.03)_45%,rgba(255,255,255,0)_100%)]"
              : "bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_42%,rgba(255,255,255,0)_100%)]"
          }`}
        />
        <div
          className={`relative min-w-[96px] px-3.5 py-2.5 text-center ${
            selected ? "scale-100" : "scale-[0.98]"
          }`}
        >
          <div className="text-[9px] font-semibold tracking-[0.28em] text-white/46">
            {pill.kicker}
          </div>
          <div
            className={`mt-1 font-semibold tracking-[0.08em] ${
              selected
                ? "text-[16px] text-white"
                : "text-[13px] text-white/86"
            }`}
          >
            {pill.value}
          </div>
          {selected && pill.meta ? (
            <div className="mt-1 text-[10px] font-medium tracking-[0.08em] text-cyan-50/72">
              {pill.meta}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={`h-4 w-px transition-all duration-300 ${
          selected
            ? "bg-gradient-to-b from-white/42 to-cyan-200/0"
            : "bg-gradient-to-b from-white/24 to-emerald-200/0"
        }`}
      />
      <div
        className={`relative h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
          selected
            ? "border-cyan-100/55 bg-cyan-200/62"
            : "border-emerald-100/28 bg-emerald-200/30"
        }`}
      >
        <div
          className={`absolute inset-[2px] rounded-full ${
            selected ? "bg-white/82" : "bg-white/48"
          }`}
        />
      </div>
    </div>
  );
}
