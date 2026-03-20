"use client";

import { useEffect } from "react";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { formatPrice, formatArea } from "@/lib/geo-utils";

const STATUS_CONFIG = {
  "for-sale": {
    label: "For Sale",
    classes:
      "bg-emerald-500/16 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  },
  sold: {
    label: "Sold",
    classes:
      "bg-red-500/16 text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  },
  reserved: {
    label: "Reserved",
    classes:
      "bg-amber-500/16 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
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

  const status = selectedParcel?.status
    ? STATUS_CONFIG[selectedParcel.status]
    : null;

  return (
    <aside
      className={`pointer-events-none fixed inset-y-0 right-0 z-30 flex items-start justify-end p-4 transition-opacity duration-300 max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:p-0 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`pointer-events-auto flex h-[calc(100vh-120px)] w-[378px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[rgba(28,25,26,0.84)] shadow-[0_26px_80px_rgba(4,16,28,0.34)] backdrop-blur-xl transition-transform duration-300 ease-out max-sm:h-[66vh] max-sm:w-full max-sm:rounded-t-[30px] max-sm:rounded-b-none ${
          isOpen
            ? "translate-x-0 max-sm:translate-y-0"
            : "translate-x-[110%] max-sm:translate-x-0 max-sm:translate-y-full"
        }`}
      >
        {selectedParcel && (
          <>
            <div className="flex items-start justify-between border-b border-white/8 px-6 pb-5 pt-6">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/56">
                    Parcel
                  </span>
                  <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.08)] px-3 py-1 text-[12px] font-semibold text-white/84">
                    {selectedParcel.id}
                  </span>
                  {status && (
                    <span
                      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${status.classes}`}
                    >
                      {status.label}
                    </span>
                  )}
                </div>
                <h2 className="max-w-[240px] text-balance text-[28px] font-semibold leading-[1.05] tracking-[-0.04em] text-white">
                  {selectedParcel.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => select(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/58 transition-colors duration-200 hover:bg-white/[0.08] hover:text-white"
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
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-3">
                {selectedParcel.priceUSD != null && selectedParcel.priceUSD > 0 && (
                  <MetricCard
                    label="Price"
                    value={formatPrice(selectedParcel.priceUSD)}
                    emphasize
                  />
                )}

                <MetricCard
                  label="Area"
                  value={formatArea(selectedParcel.areaSqMeters)}
                />

                {selectedParcel.zoning && (
                  <MetricCard
                    label="Zoning"
                    value={selectedParcel.zoning}
                  />
                )}
              </div>

              {selectedParcel.description && (
                <div className="mt-6 rounded-[26px] border border-white/8 bg-white/[0.04] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
                    Overview
                  </div>
                  <p className="text-pretty text-[14px] leading-6 text-white/66">
                    {selectedParcel.description}
                  </p>
                </div>
              )}
            </div>

            {selectedParcel.contactUrl && (
              <div className="border-t border-white/8 px-6 py-5">
                <a
                  href={selectedParcel.contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-center rounded-[22px] bg-[#194f41] px-5 text-[15px] font-semibold text-white shadow-[0_18px_40px_rgba(8,38,29,0.32)] transition-colors duration-200 hover:bg-[#21604f]"
                >
                  Contact via WhatsApp
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function MetricCard({
  emphasize = false,
  label,
  value,
}: {
  emphasize?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-white/[0.04] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
        {label}
      </div>
      <div
        className={`mt-2 font-semibold text-white ${
          emphasize
            ? "text-[24px] tracking-[-0.04em] [font-variant-numeric:tabular-nums]"
            : "text-[15px] [font-variant-numeric:tabular-nums]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
