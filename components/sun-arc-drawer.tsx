// components/sun-arc-drawer.tsx
"use client";

import { SunriseIcon, Moon02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState, useCallback, useId } from "react";

// Quadratic bezier control points — viewBox "0 0 328 58"
const P0: [number, number] = [12, 53];
const P1: [number, number] = [164, -14];
const P2: [number, number] = [316, 53];

/** Parametric point on the quadratic bezier at t ∈ [0,1] */
function bezierPoint(t: number): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * P0[0] + 2 * mt * t * P1[0] + t * t * P2[0],
    mt * mt * P0[1] + 2 * mt * t * P1[1] + t * t * P2[1],
  ];
}

/** Convert clientX drag position to arc t value, clamped to usable range */
const T_MIN = 0.02;
const T_MAX = 0.98;
function clientXToT(clientX: number, svgEl: SVGSVGElement): number {
  const rect = svgEl.getBoundingClientRect();
  const raw = (clientX - rect.left) / rect.width;
  return Math.max(T_MIN, Math.min(T_MAX, raw));
}

/** Format arc t value as a locale time string (6:00 AM → 12:00 AM) */
function tToTimeString(t: number): string {
  const totalMinutes = Math.round(t * 18 * 60); // 18-hour range
  const hour24 = 6 + Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const d = new Date();
  d.setHours(hour24 % 24, minutes, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// t ≥ DUSK_T → show moon, activate night shader
// t where sun reaches horizon: (SUNSET_HOUR=20.25 - 6) / 18 ≈ 0.792
const DUSK_T = 0.79; // moon appears as sun dips below the horizon

export interface SunArcDrawerProps {
  sunT: number;
  onSunT: (t: number) => void;
  onInteractionChange?: (interacting: boolean) => void;
}

export function SunArcDrawer({
  sunT,
  onSunT,
  onInteractionChange,
}: SunArcDrawerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const [hintSeen, setHintSeen] = useState(false);
  const uid = useId().replace(/:/g, "");

  const isNight = sunT >= DUSK_T;
  const [bx, by] = bezierPoint(sunT);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      draggingRef.current = true;
      svgRef.current.setPointerCapture(e.pointerId);
      onInteractionChange?.(true);
      onSunT(clientXToT(e.clientX, svgRef.current));
      setHintSeen(true);
    },
    [onInteractionChange, onSunT],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingRef.current || !svgRef.current) return;
      onSunT(clientXToT(e.clientX, svgRef.current));
    },
    [onSunT],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    onInteractionChange?.(false);
  }, [onInteractionChange]);

  return (
    <div className="sun-arc-enter pointer-events-none fixed inset-x-0 bottom-10 z-30 flex justify-center px-3 sm:bottom-12">
      <div className="pointer-events-auto relative w-full max-w-[390px] overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(28,25,26,0.92)] px-4 pb-4 pt-4 shadow-[0_26px_80px_rgba(4,16,28,0.34)] backdrop-blur-xl sm:px-5 sm:pb-5">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-16 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),rgba(255,255,255,0)_72%)]" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-300 ${
                  isNight
                    ? "border-sky-300/20 bg-sky-400/10 text-sky-100/78"
                    : "border-amber-300/20 bg-amber-300/10 text-amber-100/78"
                }`}
              >
                <HugeiconsIcon
                  icon={isNight ? Moon02Icon : SunriseIcon}
                  size={14}
                  strokeWidth={1.7}
                  color="currentColor"
                />
                Sun Study
              </span>
            </div>
            <div
              className={`text-[26px] font-semibold leading-none tracking-[-0.05em] transition-colors duration-300 [font-variant-numeric:tabular-nums] ${
                isNight ? "text-sky-50/92" : "text-white"
              }`}
            >
              {tToTimeString(sunT)}
            </div>
          </div>

          <div
            className={`pt-1 text-right text-[10px] font-semibold uppercase tracking-[0.18em] transition-opacity duration-300 ${
              hintSeen ? "opacity-0" : "text-white/38 opacity-100"
            }`}
          >
            Drag arc
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-4">
          <svg
            ref={svgRef}
            viewBox="0 0 328 58"
            className="w-full cursor-ew-resize touch-none select-none overflow-visible"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onLostPointerCapture={handlePointerUp}
          >
            <defs>
              <linearGradient id={`arcGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3d6db0" stopOpacity="0.68" />
                <stop offset="30%" stopColor="#d18d47" />
                <stop offset="55%" stopColor="#ebc85a" />
                <stop offset="76%" stopColor="#ba6548" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#3d4f79" stopOpacity="0.72" />
              </linearGradient>
              <radialGradient id={`sunFill-${uid}`} cx="40%" cy="35%">
                <stop offset="0%" stopColor="#fff6d8" />
                <stop offset="58%" stopColor="#f4c74c" />
                <stop offset="100%" stopColor="#ce7c29" />
              </radialGradient>
              <filter id={`glow-${uid}`}>
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <line x1="4" y1="53" x2="324" y2="53" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

            <path
              d="M 12,53 Q 164,-14 316,53"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="1.5"
              fill="none"
              style={{ pointerEvents: "none" }}
            />

            <path
              d="M 12,53 Q 164,-14 316,53"
              stroke={`url(#arcGrad-${uid})`}
              strokeWidth="2.75"
              fill="none"
              style={{ pointerEvents: "none" }}
            />

            {isNight ? (
              <>
                <circle cx={bx} cy={by} r={11} fill="rgba(180,200,255,0.08)" style={{ pointerEvents: "none" }} />
                <circle cx={bx} cy={by} r={6.3} fill="rgba(214,226,255,0.88)" filter={`url(#glow-${uid})`} style={{ pointerEvents: "none" }} />
                <circle cx={bx + 4} cy={by - 2} r={5.1} fill="rgba(28,25,26,0.92)" style={{ pointerEvents: "none" }} />
              </>
            ) : (
              <>
                <circle cx={bx} cy={by} r={14} fill="rgba(255,200,80,0.12)" style={{ pointerEvents: "none" }} />
                <circle cx={bx} cy={by} r={7.7} fill={`url(#sunFill-${uid})`} filter={`url(#glow-${uid})`} style={{ pointerEvents: "none" }} />
              </>
            )}

            <text x="12" y="52" textAnchor="middle" fill="rgba(255,255,255,0.26)" fontSize="6.5" style={{ pointerEvents: "none" }}>6am</text>
            <text x="164" y="4" textAnchor="middle" fill="rgba(255,255,255,0.26)" fontSize="6.5" style={{ pointerEvents: "none" }}>12pm</text>
            <text x="316" y="52" textAnchor="middle" fill="rgba(255,255,255,0.26)" fontSize="6.5" style={{ pointerEvents: "none" }}>12am</text>
          </svg>

          <div className="mt-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
            <span>Daybreak</span>
            <span>Solar noon</span>
            <span>Midnight</span>
          </div>
        </div>
      </div>
    </div>
  );
}
