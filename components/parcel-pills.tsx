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
              transform: `translate3d(${Math.round(pill.x)}px, ${Math.round(
                pill.y,
              )}px, 0) translate(-50%, calc(-100% - 18px))`,
              willChange: "transform",
              contain: "layout paint style",
              isolation: "isolate",
              backfaceVisibility: "hidden",
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
    <div className="relative flex flex-col items-center [transform:translateZ(0)]">
      <div
        className={`absolute top-full h-8 w-8 rounded-full blur-[14px] transition-all duration-300 ${
          selected ? "bg-cyan-300/24 max-sm:bg-cyan-500/12" : "bg-emerald-300/12 max-sm:bg-emerald-500/8"
        }`}
      />
      <div
        className={`relative overflow-hidden rounded-[22px] border shadow-[0_18px_45px_rgba(5,17,28,0.24),0_6px_18px_rgba(5,17,28,0.14)] transition-[border-color,background-color,color,box-shadow,transform] duration-300 ${
          selected
            ? "border-cyan-200/30 bg-[linear-gradient(180deg,rgba(26,48,61,0.94),rgba(14,28,38,0.9))] text-white max-sm:border-slate-400/25 max-sm:bg-[linear-gradient(180deg,rgba(215,218,224,0.94),rgba(195,200,210,0.9))] max-sm:text-slate-900 max-sm:shadow-[0_12px_36px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.07)]"
            : "border-white/10 bg-[linear-gradient(180deg,rgba(38,40,43,0.92),rgba(23,25,28,0.88))] text-white/88 max-sm:border-slate-400/18 max-sm:bg-[linear-gradient(180deg,rgba(210,212,218,0.92),rgba(190,194,204,0.88))] max-sm:text-slate-800 max-sm:shadow-[0_12px_36px_rgba(0,0,0,0.10),0_4px_12px_rgba(0,0,0,0.05)]"
        }`}
      >
        <div
          className={`absolute inset-0 ${
            selected
              ? "bg-[linear-gradient(180deg,rgba(158,241,255,0.14),rgba(158,241,255,0.04)_42%,rgba(255,255,255,0)_100%)] max-sm:bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06)_42%,rgba(255,255,255,0)_100%)]"
              : "bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03)_42%,rgba(255,255,255,0)_100%)] max-sm:bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06)_42%,rgba(255,255,255,0)_100%)]"
          }`}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10 max-sm:bg-white/30" />
        <div className="absolute inset-[1px] rounded-[21px] ring-1 ring-inset ring-white/4 max-sm:ring-white/10" />
        <div
          className={`relative min-w-[96px] px-3.5 py-2.5 text-center ${
            selected ? "scale-100" : "scale-[0.98]"
          }`}
        >
          <div className="text-[9px] font-semibold tracking-[0.28em] text-white/46 max-sm:text-slate-500">
            {pill.kicker}
          </div>
          <div
            className={`mt-1 font-semibold tracking-[0.08em] ${
              selected
                ? "text-[16px] text-white max-sm:text-slate-900"
                : "text-[13px] text-white/86 max-sm:text-slate-700"
            }`}
          >
            {pill.value}
          </div>
          {selected && pill.meta ? (
            <div className="mt-1 text-[10px] font-medium tracking-[0.08em] text-cyan-50/72 max-sm:text-cyan-700/70">
              {pill.meta}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={`h-4 w-px transition-all duration-300 ${
          selected
            ? "bg-gradient-to-b from-white/42 to-cyan-200/0 max-sm:from-slate-400/50 max-sm:to-cyan-600/0"
            : "bg-gradient-to-b from-white/24 to-emerald-200/0 max-sm:from-slate-300/50 max-sm:to-emerald-600/0"
        }`}
      />
      <div
        className={`relative h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
          selected
            ? "border-cyan-100/55 bg-cyan-200/62 max-sm:border-cyan-500/40 max-sm:bg-cyan-400/50"
            : "border-emerald-100/28 bg-emerald-200/30 max-sm:border-emerald-500/25 max-sm:bg-emerald-400/28"
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
