"use client";

import { useParcelSelection } from "@/lib/use-parcel-selection";
import { formatPrice, formatArea } from "@/lib/geo-utils";

interface ParcelCardProps {
  screenX: number;
  screenY: number;
}

export function ParcelCard({ screenX, screenY }: ParcelCardProps) {
  const { selectedParcel } = useParcelSelection();
  if (!selectedParcel) return null;

  return (
    <div
      className="fixed z-20 w-[220px] max-w-[90vw] -translate-x-1/2 max-sm:bottom-4 max-sm:left-1/2 max-sm:top-auto"
      style={{ left: screenX, top: Math.max(screenY - 20, 80) }}
    >
      <div className="rounded-xl border border-black/8 bg-[rgba(240,240,240,0.95)] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <div className="text-[10px] font-medium uppercase tracking-[1.5px] text-black/40">Selected Parcel</div>
        <div className="mt-1.5 text-base font-bold leading-tight text-[#111]">{selectedParcel.name}</div>
        {selectedParcel.description && (
          <p className="mt-2 text-[11px] leading-relaxed text-black/50">{selectedParcel.description}</p>
        )}
        <div className="mt-3 flex gap-4">
          <div>
            <div className="text-[9px] uppercase tracking-[0.5px] text-black/40">Area</div>
            <div className="text-[13px] font-semibold text-[#222]">{formatArea(selectedParcel.areaSqMeters)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.5px] text-black/40">Zoning</div>
            <div className="text-[13px] font-semibold text-[#222]">{selectedParcel.zoning}</div>
          </div>
        </div>
        <div className="mt-3 border-t border-black/8 pt-3">
          <div className="text-[9px] uppercase tracking-[0.5px] text-black/40">Price</div>
          <div className="text-lg font-bold text-[#111]">{formatPrice(selectedParcel.priceUSD)}</div>
        </div>
        <a
          href={selectedParcel.contactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-md bg-[#111] py-2 text-center text-xs font-medium text-white transition-colors hover:bg-[#333]"
        >
          Contact Agent
        </a>
      </div>
    </div>
  );
}
