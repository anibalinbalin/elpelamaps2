"use client";

import { useEffect } from "react";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { formatPrice, formatArea } from "@/lib/geo-utils";

const STATUS_CONFIG = {
  "for-sale": {
    label: "For Sale",
    classes: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  },
  sold: {
    label: "Sold",
    classes: "bg-red-500/20 text-red-400 border border-red-500/30",
  },
  reserved: {
    label: "Reserved",
    classes: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  },
};

export function ParcelSidebar() {
  const selectedParcel = useParcelSelection((s) => s.selectedParcel);
  const select = useParcelSelection((s) => s.select);
  const isOpen = selectedParcel !== null;

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") select(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, select]);

  const status = selectedParcel
    ? STATUS_CONFIG[selectedParcel.status]
    : null;

  return (
    <div
      className={`fixed right-0 top-0 z-30 h-screen w-[320px] bg-black/80 backdrop-blur-md transition-transform duration-300 ease-out max-sm:bottom-0 max-sm:right-0 max-sm:top-auto max-sm:h-[50vh] max-sm:w-full ${
        isOpen ? "translate-x-0 max-sm:translate-x-0 max-sm:translate-y-0" : "translate-x-full max-sm:translate-x-0 max-sm:translate-y-full"
      }`}
    >
      {selectedParcel && status && (
        <div className="flex h-full flex-col overflow-y-auto p-6">
          {/* Close button */}
          <button
            onClick={() => select(null)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Parcel name */}
          <h2 className="mt-4 text-xl font-bold text-white">
            {selectedParcel.name}
          </h2>

          {/* Status badge */}
          <div className="mt-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${status.classes}`}
            >
              {status.label}
            </span>
          </div>

          {/* Key metrics */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[1.5px] text-white/40">
                Price
              </div>
              <div className="mt-1 text-lg font-bold text-white">
                {formatPrice(selectedParcel.priceUSD)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[1.5px] text-white/40">
                Area
              </div>
              <div className="mt-1 text-sm font-semibold text-white/90">
                {formatArea(selectedParcel.areaSqMeters)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[1.5px] text-white/40">
                Zoning
              </div>
              <div className="mt-1 text-sm font-semibold text-white/90">
                {selectedParcel.zoning}
              </div>
            </div>
          </div>

          {/* Description */}
          {selectedParcel.description && (
            <p className="mt-6 text-sm leading-relaxed text-white/60">
              {selectedParcel.description}
            </p>
          )}

          {/* CTA button */}
          <div className="mt-auto pt-6">
            <a
              href={selectedParcel.contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-cyan-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-cyan-500"
            >
              Contact via WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
